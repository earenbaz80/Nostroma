/**
 * The version the person sees as "Nostroma". It is the DESKTOP APP's version (0.2.3), not that of Nostroma Control, the tools the app runs
 * (0.1.45, the version of the Terminal). Showing Control's number as "Nostroma" made a tester report "Nostroma 0.1.45" for the 0.2.3 app.
 * Without a real app version (a source checkout reports 'dev') the other number is the best there is.
 */
export function appVersionLabel(app: string | null | undefined, control?: string | null): string | undefined {
  const real = (v: string | null | undefined) => (typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'dev' ? v.trim() : undefined);
  return real(app) ?? real(control) ?? (typeof app === 'string' && app.trim() ? app.trim() : undefined);
}
