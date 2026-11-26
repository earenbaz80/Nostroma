/** The few React hooks the pure-logic modules import; the tests never render, so they do nothing. */
export const useSyncExternalStore = (subscribe, get) => get();
export const useEffect = () => {};
export const useLayoutEffect = () => {};
export const useState = value => [value, () => {}];
export const useRef = value => ({ current: value });
export const useCallback = fn => fn;
export const useId = () => 'test-id';
/** A context is its default value: nothing provides one here. */
export const createContext = value => ({ value });
export const useContext = context => context?.value ?? null;
