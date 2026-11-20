#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
audit_pending.py — comprobaciones pendientes de la auditoría de Nostroma.

CUATRO COMPROBACIONES
  1. tauri-plugin-updater en Cargo.lock frente a CVE-2026-95625
  2. Dockerfile: privilegios (USER; una excepción declarada con `# audit: root-ok — motivo` se muestra como AVISO con su motivo,
     nunca en una imagen publicada) y bases pinneadas por digest
  3. apps/host: binds, Origin y api_key
  4. Extracción de tar/zip: zip-slip (estático + dinámico)

SOLO LECTURA. No escribe en el proyecto. Las pruebas de extracción corren
en un directorio temporal que se elimina al terminar.

La raíz tiene que ser un checkout de Nostroma (apps/host y el motor juntos). En cualquier otra carpeta —una copia del script fuera
el repo, la raíz del sistema— la herramienta se niega con exit 2 en vez de recorrer un árbol ajeno.

Uso (la raíz por defecto es la de este repositorio, así que vale desde cualquier carpeta):
    python3 tools/audit_pending.py                     # este repositorio
    python3 tools/audit_pending.py --selftest          # valida el script con un proyecto falso
    python3 tools/audit_pending.py --root /ruta/a/Strata-main
    python3 tools/audit_pending.py --json audit.json
    python3 tools/audit_pending.py --no-dynamic        # sin pruebas de extracción

Salida: tabla con archivo:línea.
Exit code: 0 si no hay FALLA, 1 si hay al menos una.

Solo biblioteca estándar.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import re
import shutil
import sys
import tarfile
import tempfile
import textwrap
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]      # the repository this tool lives in (tools/audit_pending.py)

SKIP_DIRS = {
    ".git", "node_modules", "target", "third_party", "dist", "build",
    "__pycache__", ".venv", "venv", ".mypy_cache", ".pytest_cache",
    "HISTORY", "bench",
}

CVE_ID = "CVE-2026-95625"
AFFECTED_MIN = (2, 0, 0)
AFFECTED_MAX = (2, 12, 0)   # el registro CNA marca afectado HASTA 2.12.0 inclusive

FAIL, WARN, OK, INFO = "FALLA", "AVISO", "OK", "INFO"


# --------------------------------------------------------------------------
# utilidades
# --------------------------------------------------------------------------

def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def rel(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


def walk(root: Path, suffixes=None, names=None, skip=None):
    """Recorre el árbol podando directorios irrelevantes."""
    skip = skip or SKIP_DIRS
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip]
        for fn in filenames:
            if names and fn not in names and not any(fn.startswith(n) for n in names):
                continue
            if suffixes and not fn.endswith(tuple(suffixes)):
                continue
            out.append(Path(dirpath) / fn)
    return out


def find_calls(text: str, pattern: str, max_scan: int = 6000):
    """Devuelve [(linea, args)] para cada llamada que case con `pattern`.

    `pattern` debe terminar en '(' — se cuenta paréntesis para capturar
    argumentos multilínea. Heurístico: no entiende comentarios ni strings.
    """
    res = []
    for m in re.finditer(pattern, text):
        i = m.end() - 1
        if i < 0 or text[i] != "(":
            continue
        depth = 0
        j = i
        limit = min(len(text), i + max_scan)
        while j < limit:
            ch = text[j]
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        args = text[i + 1:j]
        line = text.count("\n", 0, m.start()) + 1
        res.append((line, args))
    return res


def split_args(args: str):
    """Separa argumentos de nivel superior."""
    parts, cur, depth, quote = [], "", 0, None
    for ch in args:
        if quote:
            cur += ch
            if ch == quote:
                quote = None
            continue
        if ch in "\"'`":
            quote = ch
            cur += ch
            continue
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(cur.strip())
            cur = ""
            continue
        cur += ch
    if cur.strip():
        parts.append(cur.strip())
    return parts


def vtuple(s: str):
    m = re.match(r"\s*(\d+)\.(\d+)\.(\d+)", s or "")
    return tuple(int(x) for x in m.groups()) if m else None


def line_of(text: str, needle: str):
    for idx, line in enumerate(text.splitlines(), 1):
        if needle in line:
            return idx
    return None


def ev(path: Path, root: Path, line) -> str:
    return f"{rel(path, root)}:{line}" if line else rel(path, root)


# --------------------------------------------------------------------------
# 1. updater / CVE-2026-95625
# --------------------------------------------------------------------------

def parse_cargo_lock(text: str):
    """name -> (version, linea_de_version)"""
    pkgs, cur = {}, None
    for idx, line in enumerate(text.splitlines(), 1):
        s = line.strip()
        m = re.match(r'name\s*=\s*"([^"]+)"', s)
        if m:
            cur = m.group(1)
            continue
        m = re.match(r'version\s*=\s*"([^"]+)"', s)
        if m and cur:
            pkgs.setdefault(cur, (m.group(1), idx))
            cur = None
    return pkgs


def check_updater(root: Path):
    rows = []
    locks = walk(root, names=["Cargo.lock"])
    if not locks:
        rows.append(("1", f"updater / {CVE_ID}", f"N/D · alta",
                     "no se encontró Cargo.lock (sin rastro del plugin)"))
        return rows

    lock = sorted(locks, key=lambda p: ("src-tauri" not in str(p), len(str(p))))[0]
    text = read_text(lock)
    pkgs = parse_cargo_lock(text)

    if "tauri-plugin-updater" not in pkgs:
        rows.append(("1", f"updater / versión", f"N/D · alta",
                     f"{ev(lock, root, None)} sin tauri-plugin-updater"))
    else:
        ver, vline = pkgs["tauri-plugin-updater"]
        v = vtuple(ver)
        where = ev(lock, root, vline)
        if v and AFFECTED_MIN <= v <= AFFECTED_MAX:
            rows.append(("1", "updater / versión", f"{FAIL} · alta",
                         f"{where} tauri-plugin-updater {ver} — afectado por {CVE_ID} "
                         f"(rango 2.0.0–2.12.0 inclusive)"))
        else:
            rows.append(("1", "updater / versión", f"{OK}",
                         f"{where} tauri-plugin-updater {ver} — fuera del rango afectado"))

    if "minisign-verify" in pkgs:
        mver, mline = pkgs["minisign-verify"]
        mv = vtuple(mver)
        note = "OK (rechaza S no canónico)" if mv and mv >= (0, 3, 0) else "AVISO: <0.3 acepta firmas maleables"
        rows.append(("1", "minisign-verify", OK if (mv and mv >= (0, 3, 0)) else INFO,
                     f"{ev(lock, root, mline)} {mver} — {note}"))

    # configuración del plugin
    confs = walk(root, names=["tauri.conf.json"])
    if not confs:
        rows.append(("1", "tauri.conf.json", f"N/D", "no encontrado"))
        return rows
    conf = confs[0]
    raw = read_text(conf)
    try:
        cfg = json.loads(raw)
    except Exception:
        cfg = {}

    upd = {}
    try:
        upd = (cfg.get("plugins") or {}).get("updater") or {}
    except AttributeError:
        upd = {}

    rsv = upd.get("require_signed_version", None)
    if rsv is None and upd:
        rsv = False
    if rsv:
        rows.append(("1", "require_signed_version", OK,
                     f"{ev(conf, root, line_of(raw, 'require_signed_version'))} activado"))
    else:
        rows.append(("1", "require_signed_version", f"{WARN} · alta",
                     f"{ev(conf, root, line_of(raw, 'require_signed_version'))} ausente/false — "
                     f"la mitigación de {CVE_ID} NO está activa aunque el plugin esté al día"))

    if upd.get("dangerousInsecureTransportProtocol"):
        rows.append(("1", "transporte", f"{FAIL} · alta",
                     f"{ev(conf, root, line_of(raw, 'dangerousInsecureTransportProtocol'))} "
                     "permite endpoints no-HTTPS"))
    else:
        rows.append(("1", "transporte", OK, "solo HTTPS"))

    if upd.get("allowDowngrades"):
        rows.append(("1", "allowDowngrades", f"{FAIL} · media",
                     f"{ev(conf, root, line_of(raw, 'allowDowngrades'))} true"))

    pk = str(upd.get("pubkey") or "")
    if pk:
        looks_path = ("/" in pk) or pk.endswith((".pub", ".key"))
        rows.append(("1", "pubkey", f"{FAIL}" if looks_path else OK,
                     f"{ev(conf, root, line_of(raw, 'pubkey'))} "
                     f"{'parece ruta de archivo' if looks_path else f'{len(pk)} chars'}: "
                     f"{'debe ser el CONTENIDO en base64' if looks_path else 'contenido en config'}"))
    return rows


# --------------------------------------------------------------------------
# 2. contenedor: privilegios y bases
# --------------------------------------------------------------------------

#: Un Dockerfile que corre como root a propósito lo declara en una línea: `# audit: root-ok — <motivo>`. Sólo esa línea cambia la fila
#: de FALLA a AVISO con el motivo a la vista, y nunca vale para una imagen publicada (el `Dockerfile` de la raíz o uno de `docker/`).
ROOT_OK = re.compile(r"^#\s*audit:\s*root-ok\s*(?:[—–:-]\s*)?(.+)$")


#: Un ARG que fija una imagen se llama como una imagen (BASE, BASE_IMAGE, CUDA_IMAGE, RUNTIME_BASE, PYTHON_IMAGE...) y su valor es UNA
#: referencia. Se mira el nombre y no el valor porque `ARG FLAVOR=cuda` no elige una imagen; y el valor tiene que ser una referencia sola,
#: así `ARG CUDA_ARCHITECTURES="75;80"` (lista) y `ARG PYTHON_VERSION=3.12` (versión) quedan afuera. `ARG BASE=ubuntu`, sin tag ni
#: registro, entra: es una imagen que no está pinneada.
#: El nombre se compara por palabras, separadas por `_`, `-` o el cambio a mayúscula, y no por subcadena: `ARG DATABASE=postgres`
#: contiene "base" y no es una imagen.
IMAGE_ARG_WORDS = {"image", "base", "ubuntu", "nvidia", "cuda", "python", "node"}
IMAGE_REF = re.compile(r"^[a-z0-9][\w.\-]*(?:/[\w.\-/]+)*(?::[\w.\-]+)?$", re.I)
NOT_AN_IMAGE = re.compile(r"[;,\s]|^v?\d+(?:\.\d+)*$|^(?:on|off|true|false|auto|yes|no|none)$", re.I)


def names_an_image(name: str) -> bool:
    """¿El nombre de este `ARG` es el de una imagen?  Por palabra: `DATABASE` no, `BASE_IMAGE` sí."""
    spaced = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", name)
    return any(word in IMAGE_ARG_WORDS for word in re.split(r"[^a-z0-9]+", spaced.lower()) if word)


def image_arg_unpinned(name: str, value: str) -> bool:
    """¿Este `ARG` de un Dockerfile fija una imagen sin digest?"""
    return (names_an_image(name) and "@sha256:" not in value
            and bool(IMAGE_REF.match(value)) and not NOT_AN_IMAGE.search(value))


def declared_root_ok(text: str):
    """(línea, motivo) de la excepción declarada en un Dockerfile, o None."""
    for idx, line in enumerate(text.splitlines(), 1):
        m = ROOT_OK.match(line.strip())
        if m:
            return idx, m.group(1).strip()
    return None


def check_docker(root: Path):
    rows = []
    dockerfiles = walk(root, names=["Dockerfile"])
    if not dockerfiles:
        rows.append(("2", "Dockerfile", "N/D", "no encontrado"))
        return rows

    # todos, no los primeros: con un tope se salteaba docker/Dockerfile, que es una de las imágenes que se publican
    for df in dockerfiles:
        text = read_text(df)
        froms, users, args = [], [], {}
        for idx, line in enumerate(text.splitlines(), 1):
            s = line.strip()
            if s.upper().startswith("FROM "):
                froms.append((idx, s[5:].strip()))
            elif s.upper().startswith("USER "):
                users.append((idx, s[5:].strip()))
            m = re.match(r"ARG\s+(\w+)=(.+)", s, re.I)
            if m:
                args[m.group(1)] = m.group(2).strip()

        # entrypoint
        eps = [p for p in walk(root, suffixes=[".sh"])
               if "entrypoint" in p.name.lower()] or \
              [p for p in walk(root, suffixes=[".sh"]) if p.parent.name == "docker"]
        drops = None
        ep_ref = None
        for ep in eps[:2]:
            etext = read_text(ep)
            if re.search(r"su-exec|gosu|setpriv|exec\s+su\s", etext):
                drops = ev(ep, root, line_of(etext, "exec") or line_of(etext, "su"))
                ep_ref = ep
                break

        if users:
            uline, uval = users[-1]
            is_root = uval.split(":")[0].strip().lower() in ("root", "0")
            rows.append(("2", f"USER final ({df.parent.name}/)", f"{FAIL} · alta" if is_root else OK,
                         f"{ev(df, root, uline)} USER {uval}"))
        elif drops:
            rows.append(("2", "privilegios", f"{WARN} · media",
                         f"sin USER en {rel(df, root)}, pero el entrypoint baja privilegios "
                         f"({drops})"))
        else:
            declared = declared_root_ok(text)
            published = df.parent == root or df.parent.name == "docker"
            if declared and not published:
                rows.append(("2", "privilegios", f"{WARN} · media",
                             f"{rel(df, root)} sin USER, root declarado en el propio archivo: "
                             f"{ev(df, root, declared[0])} — {declared[1][:150]}"))
            elif declared:
                rows.append(("2", "privilegios", f"{FAIL} · alta",
                             f"{rel(df, root)} sin USER: una imagen publicada no puede declararse root "
                             f"({ev(df, root, declared[0])} no vale acá)"))
            else:
                rows.append(("2", "privilegios", f"{FAIL} · alta",
                             f"{rel(df, root)} sin USER y sin su-exec/gosu en entrypoint — "
                             f"el proceso corre como root"))

        def digested(spec: str) -> bool:
            """`FROM imagen@sha256:...`, o `FROM ${VAR}` cuando el ARG de VAR trae el digest como valor por defecto."""
            if "@sha256:" in spec:
                return True
            m = re.match(r"^\$\{?(\w+)\}?(?:\s|$)", spec)
            return bool(m) and "@sha256:" in args.get(m.group(1), "")

        undigested = [(i, f) for i, f in froms if not digested(f)]
        if undigested:
            i, f = undigested[0]
            rows.append(("2", "bases por digest", f"{WARN} · media",
                         f"{ev(df, root, i)} FROM {f[:60]} — sin @sha256 (no reproducible)"))
        elif froms:
            rows.append(("2", "bases por digest", OK, "todas por digest"))

        for name, value in args.items():
            if image_arg_unpinned(name, value):
                rows.append(("2", "ARG de imagen", f"{WARN} · media",
                             f"{ev(df, root, line_of(text, name))} ARG {name}={value[:50]} — sin digest"))
                break

    # compose: publicación de puertos
    for comp in walk(root, names=["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"]):
        ctext = read_text(comp)
        for idx, line in enumerate(ctext.splitlines(), 1):
            if re.search(r'-\s*"?\d+:\d+', line) and "127.0.0.1" not in line:
                rows.append(("2", "puertos en compose", f"{WARN} · media",
                             f"{ev(comp, root, idx)} {line.strip()} — publica en 0.0.0.0 "
                             "aunque la app escuche en loopback"))
                break
    return rows


# --------------------------------------------------------------------------
# comparaciones estrictas de una api_key
# --------------------------------------------------------------------------

_KEY_NAME = r"api_?[kK]ey\w*"
_OPERAND = r"(?:[A-Za-z_$][\w$.\[\]'\"]*|\([^()\n]*\)|-?\d+(?:\.\d+)?)"
# un valor que no es una credencial: la forma del cuerpo o del store, nunca una clave con la que se compara
_LITERALS = {"null", "true", "false", "undefined", "None", "True", "False"}
_TYPEOF_KEY = re.compile(r"\btypeof\s*\(?\s*[\w$.\[\]'\"]*?" + _KEY_NAME)


def _names_key(expr: str) -> bool:
    """¿La expresión es una api_key (`key`, `body.apiKey`, `s.serving?.apiKey`)?"""
    return bool(re.search(r"(?:^|[.\s(])" + _KEY_NAME + r"$", expr.strip()))


def _operand_before(text: str) -> str:
    m = re.search(_OPERAND + r"\s*$", text)
    return m.group(0) if m else ""


def _operand_after(text: str) -> str:
    m = re.match(r"\s*(" + _OPERAND + r")", text)
    return m.group(1) if m else ""


def strict_key_comparisons(text: str):
    """[(linea, fragmento)] de cada `x === y` / `x !== y` en el que un lado es una api_key y el otro un valor de verdad.

    Se dejan fuera los dos usos que no comparan una credencial: contra null/true/false/undefined (`body.apiKey === null`
    pregunta por la forma del cuerpo o del store) y detrás de un `typeof` (`typeof body.apiKey === 'string'` pregunta
    por el tipo). Un `===` con una clave a un lado y un valor al otro sí se informa.
    """
    out = []
    for m in re.finditer(r"===|!==", text):
        start = text.rfind("\n", 0, m.start()) + 1
        end = text.find("\n", m.end())
        end = len(text) if end < 0 else end
        line = text[start:end]
        left = _operand_before(text[start:m.start()])
        right = _operand_after(text[m.end():end])
        if _names_key(left) and right:
            other = right
        elif _names_key(right) and left:
            other = left
        else:
            continue
        if other.strip().strip("()").strip() in _LITERALS:
            continue
        if _TYPEOF_KEY.search(line):
            continue
        out.append((text.count("\n", 0, m.start()) + 1, line.strip()))
    return out


# --------------------------------------------------------------------------
# 3. host: binds / Origin / api_key
# --------------------------------------------------------------------------

def check_host(root: Path):
    rows = []
    base = root / "apps" / "host"
    if not base.is_dir():
        rows.append(("3", "apps/host", "N/D", "no encontrado"))
        return rows

    files = [p for p in walk(base, suffixes=[".mjs", ".js", ".ts"])
             if not p.name.endswith(".d.ts") and p.name != "server"]
    if not files:
        rows.append(("3", "apps/host", "N/D", "sin fuentes .mjs/.js/.ts"))
        return rows

    no_host, wildcard_cors, ws_files, host_hdr, tsafe, strict_eq = [], [], [], [], [], []
    listens_total = 0

    for f in files:
        text = read_text(f)
        if not text:
            continue
        for line, args in find_calls(text, r"\.listen\s*\("):
            listens_total += 1
            parts = split_args(args)
            if len(parts) >= 2:
                continue
            if len(parts) == 1 and re.search(r"\bhost\b", parts[0]):
                continue
            no_host.append(ev(f, root, line))

        for line, args in find_calls(text, r"\bcors\s*\("):
            if re.search(r"origin\s*:\s*(\*|true)", args):
                wildcard_cors.append(ev(f, root, line))

        if re.search(r"WebSocketServer|handleUpgrade|verifyClient", text):
            ws_files.append((f, bool(re.search(r"origin", text, re.I))))

        if re.search(r"headers\s*\.\s*host|\[\s*[\"']host[\"']\s*\]", text, re.I):
            host_hdr.append(ev(f, root, line_of(text, "host")))
        if "timingSafeEqual" in text:
            tsafe.append(rel(f, root))
        for line, _snippet in strict_key_comparisons(text):
            strict_eq.append(ev(f, root, line))

    rows.append(("3", "listen() con host", f"{FAIL} · alta" if no_host else OK,
                 f"{listens_total} listeners; sin host explícito: {', '.join(no_host[:4]) or 'ninguno'}"))

    rows.append(("3", "CORS comodín", f"{FAIL} · media" if wildcard_cors else OK,
                 f"{', '.join(wildcard_cors[:4]) or 'sin origin:*/true'}"))

    if ws_files:
        bad = [rel(f, root) for f, has_o in ws_files if not has_o]
        rows.append(("3", "Origin en WebSocket", f"{WARN} · media" if bad else OK,
                     f"{len(ws_files)} archivos con WS; sin mención de origin: "
                     f"{', '.join(bad[:3]) or 'ninguno'}"))
    else:
        rows.append(("3", "Origin en WebSocket", INFO, "no se detectó WebSocketServer"))

    rows.append(("3", "cabecera Host (rebinding)", f"{WARN} · media" if not host_hdr else OK,
                 f"{', '.join(host_hdr[:3]) or 'sin validación aparente de Host'}"))

    rows.append(("3", "comparación de api_key",
                 OK if (tsafe and not strict_eq) else (f"{WARN} · baja" if strict_eq else INFO),
                 f"timingSafeEqual en {', '.join(tsafe[:2]) or 'ninguno'}; "
                 f"comparación directa: {', '.join(strict_eq[:3]) or 'ninguna'}"))
    return rows


# --------------------------------------------------------------------------
# 4. extracción tar/zip
# --------------------------------------------------------------------------

def dynamic_extraction():
    """Mide el comportamiento del INTÉRPRETE, no del proyecto."""
    out = []
    base = Path(tempfile.mkdtemp(prefix="strata-audit-"))
    try:
        evil = base / "evil.tar"

        def add(tf, name, data=b"pwned\n", **kw):
            ti = tarfile.TarInfo(name)
            for k, v in kw.items():
                setattr(ti, k, v)
            if ti.type == tarfile.REGTYPE:
                ti.size = len(data)
                tf.addfile(ti, io.BytesIO(data))
            else:
                tf.addfile(ti)

        with tarfile.open(evil, "w") as tf:
            add(tf, "../../evil-traversal.txt")
            add(tf, "link", type=tarfile.SYMTYPE, linkname=str(base))
            add(tf, "link/evil-symlink.txt")

        zevil = base / "evil.zip"
        with zipfile.ZipFile(zevil, "w") as z:
            z.writestr("../../evil-zip.txt", "pwned")

        cases = [
            ("tar sin filter (default del intérprete)", None),
            ("tar filter='data'", "data"),
            ("tar filter='fully_trusted' (control)", "fully_trusted"),
        ]
        for label, filt in cases:
            dest = base / "run" / "d1" / "d2"
            shutil.rmtree(base / "run", ignore_errors=True)
            dest.mkdir(parents=True)
            for leftover in ("evil-traversal.txt", "evil-symlink.txt"):
                p = base / leftover
                if p.exists() or p.is_symlink():
                    p.unlink(missing_ok=True)
            err = "-"
            try:
                with tarfile.open(evil) as tf:
                    tf.extractall(dest, filter=filt) if filt else tf.extractall(dest)
            except Exception as exc:  # noqa: BLE001
                err = type(exc).__name__
            escaped = [n for n in ("evil-traversal.txt", "evil-symlink.txt")
                       if (base / n).exists() or (base / n).is_symlink()]
            out.append((label, err, ", ".join(escaped) or "ninguno"))

        dest = base / "zrun" / "d1" / "d2"
        dest.mkdir(parents=True)
        err = "-"
        try:
            with zipfile.ZipFile(zevil) as z:
                z.extractall(dest)
        except Exception as exc:  # noqa: BLE001
            err = type(exc).__name__
        escaped = "evil-zip.txt" if (base / "evil-zip.txt").exists() else "ninguno"
        out.append(("zip extractall (control)", err, escaped))
    finally:
        shutil.rmtree(base, ignore_errors=True)
    return out


def python_floor(root: Path):
    pats = [
        (["setup.py"], r"python_requires\s*=\s*[\"']([^\"']+)"),
        (["pyproject.toml"], r"requires-python\s*=\s*[\"']([^\"']+)"),
    ]
    for names, pat in pats:
        for p in walk(root, names=names):
            text = read_text(p)
            m = re.search(pat, text)
            if m:
                return m.group(1), ev(p, root, line_of(text, m.group(1)))
    return None, None


#: An extraction call: `tf.extractall(`, `f.extract(`, `shutil.unpack_archive(`. The lookbehind leaves `safe_extract(` out (the
#: project's own wrapper) and still lets `updater.extract(` match with its receiver.
EXTRACT_CALL = re.compile(r"(?<![\w.])(?<!def )(?:(\w+)\.)?(extractall|extract|unpack_archive)\s*\(")
#: The objects a file opens itself, so a call is told apart from a function of the project that happens to be named extract.
TAR_OBJECT = (r"(?:with[ \t]+)?tarfile\.open\((?:[^()\n]|\([^()\n]*\))*\)[ \t]+as[ \t]+(\w+)",
              r"(\w+)[ \t]*=[ \t]*tarfile\.open\(")
ZIP_OBJECT = (r"(?:with[ \t]+)?zipfile\.ZipFile\((?:[^()\n]|\([^()\n]*\))*\)[ \t]+as[ \t]+(\w+)",
              r"(\w+)[ \t]*=[ \t]*zipfile\.ZipFile\(")


def call_args(text: str, open_paren: int, max_scan: int = 6000) -> str:
    """The text between the parentheses of a call whose '(' is at `open_paren`."""
    depth, j = 0, open_paren
    limit = min(len(text), open_paren + max_scan)
    while j < limit:
        ch = text[j]
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                break
        j += 1
    return text[open_paren + 1:j]


def extraction_sites(files):
    """[(archivo, línea, clase, tiene_filter)] de cada extracción de archivo en las fuentes Python.

    Clases: `tar` (un objeto que el archivo abre con `tarfile.open`: el único caso donde `filter="data"` existe y hace falta),
    `zip` y `unpack` (`ZipFile`, `shutil.unpack_archive`: no tienen parámetro `filter`, y zipfile sanea los nombres y nunca crea
    enlaces), e `indirect` (una llamada a una función del proyecto —`updater.extract`, `components.safe_extract`— que valida los
    miembros antes de escribir). Sólo `tar` cuenta como fallo: es lo único que el filtro puede arreglar.

    Heurístico: un objeto de tar que llegue como parámetro de otra función no se reconoce y cae en `indirect`.
    """
    out = []
    for f in files:
        text = read_text(f)
        if not text:
            continue
        tar = {name for pat in TAR_OBJECT for name in re.findall(pat, text)}
        zipped = {name for pat in ZIP_OBJECT for name in re.findall(pat, text)}
        for m in EXTRACT_CALL.finditer(text):
            args = call_args(text, m.end() - 1)
            kind = ("unpack" if m.group(2) == "unpack_archive" else
                    "tar" if m.group(1) in tar else
                    "zip" if m.group(1) in zipped else "indirect")
            out.append((f, text.count("\n", 0, m.start()) + 1, kind, "filter" in args))
    return out


def check_extraction(root: Path, dynamic: bool):
    rows = []
    py = [p for p in walk(root, suffixes=[".py"]) if p.name != "audit_pending.py"]
    sites = extraction_sites(py)
    no_filter = [(f, l) for f, l, kind, ok in sites if kind == "tar" and not ok]
    with_filter = [(f, l) for f, l, kind, ok in sites if kind == "tar" and ok]
    zips = sum(1 for _f, _l, kind, _ok in sites if kind == "zip")
    indirect = sum(1 for _f, _l, kind, _ok in sites if kind in ("unpack", "indirect"))

    floor, floor_ev = python_floor(root)
    cur = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"

    if not sites:
        rows.append(("4", "llamadas de extracción", INFO,
                     f"ninguna en código de primer nivel (intérprete {cur})"))
    else:
        rows.append(("4", "extracción sin filter",
                     f"{FAIL} · alta" if (no_filter and (vtuple(floor or "0") or (0,)) < (3, 14)) else
                     (f"{WARN} · media" if no_filter else OK),
                     f"{len(no_filter)} tar sin filter: "
                     f"{', '.join(ev(f, root, l) for f, l in no_filter[:4]) or 'ninguna'}; "
                     f"{len(with_filter)} tar con filter; {zips} zip y {indirect} indirectas (sin parámetro filter)"))
        rows.append(("4", "llamadas con filter", OK if with_filter else INFO,
                     ", ".join(ev(f, root, l) for f, l in with_filter[:4]) or "ninguna"))

    loops = []
    for f in py:
        text = read_text(f)
        for pat in (r"namelist\s*\(", r"getmembers\s*\(", r"infolist\s*\("):
            for line, _ in find_calls(text, pat.replace("\\(", "\\(")):
                loops.append(ev(f, root, line))
    rows.append(("4", "bucles manuales", f"{WARN} · alta" if loops else OK,
                 f"{', '.join(loops[:4]) or 'sin namelist/getmembers/infolist'}"))

    declared = f"{floor} ({floor_ev})" if floor else f"no declarado ({floor_ev or 'n/d'})"
    rows.append(("4", "mínimo de Python", INFO,
                 f"declarado: {declared}; intérprete actual {cur}"))

    if dynamic:
        for label, err, escaped in dynamic_extraction():
            bad = escaped != "ninguno"
            if "fully_trusted" in label:
                # control negativo: con fully_trusted escapar es lo correcto
                verdict = OK
                note = "control: escapó como se esperaba" if bad else "control: no escapó"
            elif bad:
                verdict = f"{WARN} · media"
                note = "el intérprete no contiene la extracción"
            else:
                verdict = OK
                note = "contenido dentro del destino"
            rows.append(("4", f"dyn: {label[:30]}", verdict,
                         f"excepción={err}; escapó: {escaped} — {note}"))
    return rows


# --------------------------------------------------------------------------
# selftest
# --------------------------------------------------------------------------

def build_fixture(root: Path) -> None:
    """Árbol de proyecto falso, mínimo, para ejercitar las cuatro comprobaciones."""
    st = root / "apps" / "desktop" / "src-tauri"
    st.mkdir(parents=True, exist_ok=True)
    (st / "Cargo.lock").write_text(
        'version = 3\n\n'
        '[[package]]\n'
        'name = "tauri-plugin-updater"\n'
        'version = "2.9.0"\n'
        'source = "registry+https://github.com/rust-lang/crates.io-index"\n',
        encoding="utf-8",
    )

    # la imagen publicada lleva la misma línea de excepción que una de desarrollo, y aun así tiene que ser FALLA
    (root / "Dockerfile").write_text(
        "# audit: root-ok — esto no vale para una imagen publicada\n"
        "FROM ubuntu:24.04\n"
        # contiene "base" y no es una imagen: es el único ARG de esta imagen, así que una regla por subcadena se vería acá
        "ARG DATABASE=postgres\n"
        "EXPOSE 8080\n"
        'CMD ["python3", "-m", "http.server"]\n',
        encoding="utf-8",
    )
    # y una tercera en docker/, que también se publica: la excepción tiene que rechazarse ahí igual que en la raíz
    pubdir = root / "docker"
    pubdir.mkdir(parents=True, exist_ok=True)
    (pubdir / "Dockerfile").write_text(
        "# audit: root-ok — tampoco vale en docker/\n"
        "FROM ubuntu:24.04\n"
        "EXPOSE 8080\n",
        encoding="utf-8",
    )
    # una imagen de desarrollo que sí declara por qué corre como root: AVISO con el motivo
    dev = root / "tools" / "devimg"
    dev.mkdir(parents=True, exist_ok=True)
    (dev / "Dockerfile").write_text(
        "# caja de herramientas, no se publica\n"
        "# audit: root-ok — caja de herramientas, se usa con -u $(id -u):$(id -g)\n"
        "ARG BASE=ubuntu\n"                      # una imagen sin tag ni registro: no está pinneada y hay que verla
        "ARG FLAVOR=cuda\n"                      # no es una imagen
        'ARG CUDA_ARCHITECTURES="75;80"\n'       # una lista, no una imagen
        "ARG PYTHON_VERSION=3.12\n"              # una versión, no una imagen
        "FROM ubuntu:24.04\n"
        'ENTRYPOINT ["/bin/bash", "-lc"]\n',
        encoding="utf-8",
    )

    host = root / "apps" / "host"
    host.mkdir(parents=True, exist_ok=True)
    # tres comparaciones: una real (se informa) y dos que no comparan una credencial (se dejan fuera)
    (host / "server.mjs").write_text(
        "import http from 'node:http';\n"
        "const key = 'k';\n"
        "const server = http.createServer(() => {});\n"
        "server.listen(8080);\n"
        "export function shape(body) {\n"
        "  if (body.apiKey === null) return 'remove';\n"
        "  if (typeof body.apiKey === 'string') return body.apiKey.trim();\n"
        "  return '';\n"
        "}\n"
        "export function check(given) {\n"
        "  return apiKey === given;\n"
        "}\n",
        encoding="utf-8",
    )

    # el fixture tiene que parecer un checkout: apps/host más algo del motor, si no root_problem() lo rechaza
    (root / "CMakeLists.txt").write_text("cmake_minimum_required(VERSION 3.20)\n", encoding="utf-8")

    tools = root / "tools"
    tools.mkdir(parents=True, exist_ok=True)
    # one tar without the filter (the failure), one with it, one zip and one call to the project's own wrapper (neither counts)
    (tools / "unpacker.py").write_text(
        "import tarfile\n"
        "import zipfile\n\n\n"
        "def unpack(path, dest):\n"
        "    with tarfile.open(path) as tf:\n"
        "        tf.extractall(dest)\n\n\n"
        "def unpack_checked(path, dest):\n"
        "    with tarfile.open(path) as tf:\n"
        "        tf.extractall(dest, **({'filter': 'data'} if hasattr(tarfile, 'data_filter') else {}))\n\n\n"
        "def unpack_zip(path, dest):\n"
        "    with zipfile.ZipFile(path) as zf:\n"
        "        zf.extractall(dest)\n\n\n"
        "def unpack_safe(archive, dest):\n"
        "    from nostroma_control import components\n"
        "    components.safe_extract(archive, dest)\n",
        encoding="utf-8",
    )


def _verdict_of(rows, label):
    for row in rows:
        if row[1] == label:
            return str(row[2])
    return None


def run_selftest() -> int:
    base = Path(tempfile.mkdtemp(prefix="strata-selftest-"))
    suites = [
        ("1", "updater / versión", lambda: check_updater(base)),
        ("2", "privilegios", lambda: check_docker(base)),
        ("3", "listen() con host", lambda: check_host(base)),
        ("4", "extracción sin filter", lambda: check_extraction(base, False)),
    ]
    failures = 0
    try:
        build_fixture(base)
        print(f"\nSELFTEST — proyecto falso en {base}\n")
        for num, label, fn in suites:
            try:
                rows = fn()
            except Exception as exc:  # noqa: BLE001
                print(f"  FALLO  [{num}] {label}: excepción {type(exc).__name__}: {exc}")
                failures += 1
                continue
            verdict = _verdict_of(rows, label)
            ok = verdict is not None and verdict.startswith(FAIL)
            extra = "" if ok else f" (se esperaba {FAIL})"
            print(f"  {'ok    ' if ok else 'FALLO '}[{num}] {label} → {verdict!r}{extra}")
            if not ok:
                failures += 1
                for row in rows:
                    print(f"          · {row[1]}: {row[2]} — {row[3]}")

        # controles: el control fully_trusted no es FALLA y el mínimo se imprime bien
        try:
            rows = check_extraction(base, True)
        except Exception as exc:  # noqa: BLE001
            print(f"  FALLO  [4] controles de extracción: excepción {type(exc).__name__}: {exc}")
            failures += 2
            extras = 7
        else:
            extras = 7
            ctl = [r for r in rows if "fully_trusted" in r[1]]
            ctl_ok = bool(ctl) and str(ctl[0][2]).startswith(OK)
            print(f"  {'ok    ' if ctl_ok else 'FALLO '}[4] control fully_trusted no cuenta como FALLA"
                  f" → {ctl[0][2]!r}" if ctl else "  FALLO [4] control fully_trusted: fila ausente")
            if not ctl_ok:
                failures += 1

            pf = [r for r in rows if r[1] == "mínimo de Python"]
            det = pf[0][3] if pf else ""
            pf_ok = det.startswith("declarado: no declarado (n/d);")
            print(f"  {'ok    ' if pf_ok else 'FALLO '}[4] formato del mínimo de Python → {det!r}")
            if not pf_ok:
                failures += 1

        # control: la comparación de api_key ve la real y deja fuera las de forma y de tipo
        try:
            rows = check_host(base)
        except Exception as exc:  # noqa: BLE001
            print(f"  FALLO  [3] api_key: excepción {type(exc).__name__}: {exc}")
            failures += 1
        else:
            api = [r for r in rows if r[1] == "comparación de api_key"]
            detail = str(api[0][3]) if api else ""
            lines = (base / "apps" / "host" / "server.mjs").read_text(encoding="utf-8").splitlines()
            def _line_of(fragment):
                return next((i for i, text in enumerate(lines, 1) if fragment in text), None)
            real = _line_of("apiKey === given")
            shape, kind = _line_of("apiKey === null"), _line_of("typeof body.apiKey")
            seen = real is not None and f"server.mjs:{real}" in detail
            noisy = [n for n in (shape, kind) if n and f"server.mjs:{n}" in detail]
            api_ok = bool(api) and seen and not noisy
            print(f"  {'ok    ' if api_ok else 'FALLO '}[3] api_key: real informada={seen}, "
                  f"forma/tipo filtradas={not noisy} → {detail[:100]!r}")
            if not api_ok:
                failures += 1

        # control: sólo el tar sin filter cuenta; un zip, el tar con filter y la llamada al envoltorio no
        try:
            rows = check_extraction(base, False)
        except Exception as exc:  # noqa: BLE001
            print(f"  FALLO  [4] clasificación de extracciones: excepción {type(exc).__name__}: {exc}")
            failures += 1
        else:
            det = next((str(r[3]) for r in rows if r[1] == "extracción sin filter"), "")
            lines = (base / "tools" / "unpacker.py").read_text(encoding="utf-8").splitlines()
            def _line_of(fragment):
                return next((i for i, text in enumerate(lines, 1) if fragment in text), None)
            bare, checked = _line_of("tf.extractall(dest)"), _line_of("data_filter")
            zipped, wrapped = _line_of("zf.extractall(dest)"), _line_of("components.safe_extract")
            others = [n for n in (checked, zipped, wrapped) if n and f"unpacker.py:{n}" in det]
            only_tar = det.startswith("1 tar sin filter") and bare and f"unpacker.py:{bare}" in det and not others
            print(f"  {'ok    ' if only_tar else 'FALLO '}[4] extracción: sólo el tar sin filter cuenta → {det[:110]!r}")
            if not only_tar:
                failures += 1

        # control: una raíz que no es un checkout se rechaza (raíz del sistema, carpeta cualquiera) y la del fixture pasa
        root_ok = (root_problem(Path("/").resolve()) is not None
                   and root_problem(Path(tempfile.mkdtemp(prefix="strata-no-checkout-"))) is not None
                   and root_problem(base) is None)
        print(f"  {'ok    ' if root_ok else 'FALLO '}[5] raíz: se niega fuera de un checkout de Nostroma y acepta el del fixture")
        if not root_ok:
            failures += 1

        # control: la excepción declarada es AVISO con su motivo, y no vale para la imagen publicada
        try:
            rows = check_docker(base)
        except Exception as exc:  # noqa: BLE001
            print(f"  FALLO  [2] root declarado: excepción {type(exc).__name__}: {exc}")
            failures += 1
        else:
            priv = [(str(r[3]), str(r[2])) for r in rows if r[1] == "privilegios"]
            dev = next(((d, v) for d, v in priv if "devimg/Dockerfile" in d), ("", ""))
            pub = next(((d, v) for d, v in priv if d.startswith("Dockerfile ")), ("", ""))
            pubdir = next(((d, v) for d, v in priv if d.startswith("docker/Dockerfile")), ("", ""))
            declared_ok = dev[1].startswith(WARN) and "-u $(id -u)" in dev[0]
            # las dos publicadas llevan la misma línea y aun así son FALLA, y docker/Dockerfile se examina (antes quedaba afuera)
            published_ok = pub[1].startswith(FAIL) and pubdir[1].startswith(FAIL)
            print(f"  {'ok    ' if declared_ok and published_ok else 'FALLO '}[2] root declarado: "
                  f"dev={dev[1]!r} raíz={pub[1]!r} docker/={pubdir[1]!r}")
            if not (declared_ok and published_ok):
                failures += 1

            # control: `ARG BASE=ubuntu` sin pin se ve; el sabor, la lista de arquitecturas, la versión y DATABASE (que contiene
            # "base") no son imágenes
            argrows = [str(r[3]) for r in rows if r[1] == "ARG de imagen"]
            seen_base = any("devimg/Dockerfile" in d and "ARG BASE=ubuntu" in d for d in argrows)
            noise = [d for d in argrows if re.search(r"FLAVOR|ARCHITECTURES|PYTHON_VERSION|DATABASE", d)]
            args_ok = seen_base and not noise
            print(f"  {'ok    ' if args_ok else 'FALLO '}[2] ARG de imagen: BASE sin pin visto={seen_base}, "
                  f"falsos={len(noise)}")
            if not args_ok:
                failures += 1
    finally:
        shutil.rmtree(base, ignore_errors=True)

    total = len(suites) + extras
    print(f"\nselftest: {total - failures}/{total} correctas")
    return 0 if failures == 0 else 1


# --------------------------------------------------------------------------
# tabla
# --------------------------------------------------------------------------

def render(rows):
    term = shutil.get_terminal_size((110, 24)).columns
    widths = [3, 27, 15]
    widths.append(max(34, term - sum(widths) - 3 * (len(widths))))
    headers = ["#", "Comprobación", "Veredicto", "Evidencia / detalle (archivo:línea)"]

    def wrap_row(cells):
        out = []
        for cell, w in zip(cells, widths):
            lines = []
            for part in str(cell).split("\n"):
                lines.extend(textwrap.wrap(part, w) or [""])
            out.append(lines)
        return out

    total = sum(widths) + 3 * (len(widths) - 1)
    print("=" * total)
    print(" | ".join(h.ljust(w) for h, w in zip(headers, widths)))
    print("=" * total)
    for cells in rows:
        wrapped = wrap_row(cells)
        height = max(len(c) for c in wrapped)
        for i in range(height):
            print(" | ".join((c[i] if i < len(c) else "").ljust(w)
                             for c, w in zip(wrapped, widths)))
        print("-" * total)


#: Lo que un checkout de Nostroma tiene además de la app: el motor (CMake), el servidor y el empaquetado.
CHECKOUT_MARKERS = ("CMakeLists.txt", "serve/server.py", "packaging")


def root_problem(root: Path):
    """Por qué `root` no es un checkout de Strata, o None cuando lo es.

    Copiado fuera del repositorio, la raíz por defecto del script viaja con él: una copia en /tmp hacía que el escaneo saliera a
    recorrer el disco entero (y a marcar archivos del sistema). Un checkout es donde viven apps/host y el motor; cualquier otra
    carpeta es un error de uso, no un objetivo.
    """
    if root.parent == root:                                   # / en POSIX, C:\\ en Windows
        return (f"{root} es la raíz del sistema de archivos, no un checkout de Nostroma: ahí no hay apps/host, y recorrerla leería el "
                f"disco entero. Indicá el repositorio: --root <ruta a Strata-main>.")
    if not (root / "apps" / "host").is_dir():
        return (f"{root} no es un checkout de Nostroma: no tiene apps/host, que es lo que audita esta herramienta. Con una raíz "
                f"equivocada recorrería un árbol ajeno. Indicá el repositorio: --root <ruta a Strata-main>.")
    if not any((root / marker).exists() for marker in CHECKOUT_MARKERS):
        return (f"{root} tiene apps/host pero nada más de Nostroma ({', '.join(CHECKOUT_MARKERS)}: ninguna existe), así que no es la raíz "
                f"del repositorio y el resto de las comprobaciones darían cualquier cosa. Indicá el repositorio: --root <ruta a Strata-main>.")
    return None


def main():
    ap = argparse.ArgumentParser(description="Comprobaciones pendientes de la auditoría de Nostroma")
    ap.add_argument("--root", default=str(ROOT), help="raíz del proyecto (por defecto, este repositorio)")
    ap.add_argument("--json", help="volcar filas a JSON")
    ap.add_argument("--no-dynamic", action="store_true", help="omitir pruebas de extracción")
    ap.add_argument("--selftest", action="store_true",
                    help="valida el script con un proyecto falso en un directorio temporal")
    args = ap.parse_args()

    if args.selftest:
        sys.exit(run_selftest())

    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        sys.exit(f"raíz no válida: {root}")
    problem = root_problem(root)
    if problem:
        print(problem, file=sys.stderr)
        sys.exit(2)

    print(f"\nraíz:   {root}")
    print(f"python: {sys.version.split()[0]}")
    print(f"fecha:  {__import__('datetime').date.today()}\n")

    rows = []
    for fn in (check_updater, check_docker, check_host):
        try:
            rows.extend(fn(root))
        except Exception as exc:  # noqa: BLE001
            rows.append((fn.__name__, "error", f"{WARN}", f"{type(exc).__name__}: {exc}"))
    try:
        rows.extend(check_extraction(root, not args.no_dynamic))
    except Exception as exc:  # noqa: BLE001
        rows.append(("4", "extracción", f"{WARN}", f"{type(exc).__name__}: {exc}"))

    render(rows)

    fatales = [r for r in rows if str(r[2]).startswith(FAIL)]
    print(f"\nresumen: {len(rows)} comprobaciones, {len(fatales)} FALLA, "
          f"{sum(1 for r in rows if str(r[2]).startswith(WARN))} AVISO")

    print("\nNOTAS")
    print("  · Sin git disponible: no hay historial ni autores.")
    print("  · third_party/, node_modules/ y target/ excluidos del escaneo.")
    print("  · Escaneo estático heurístico: indica dónde mirar, no prueba el flujo.")
    print("  · Las filas 'dyn:' miden el INTÉRPRETE, no el código del proyecto.")
    print("  · Se examinan todos los Dockerfiles del proyecto (third_party/ queda fuera, como el resto del escaneo).")
    print("  · Un Dockerfile de desarrollo declara por qué corre como root con `# audit: root-ok — motivo`: AVISO con el motivo, y la")
    print("    excepción no vale para el Dockerfile de la raíz ni para uno de docker/, que son los que se publican.")

    if args.json:
        Path(args.json).write_text(
            json.dumps([{"n": r[0], "check": r[1], "verdict": r[2], "detail": r[3]}
                        for r in rows], ensure_ascii=False, indent=2),
            encoding="utf-8")
        print(f"  · JSON: {args.json}")

    sys.exit(1 if fatales else 0)


if __name__ == "__main__":
    main()
