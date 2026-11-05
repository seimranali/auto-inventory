import { useCallback, useEffect, useState } from 'react';

// Runs an async loader whenever deps change; returns { data, error, loading, reload, setData }
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const run = useCallback(() => {
    setState(s => ({ ...s, loading: true }));
    return fn()
      .then(data => setState({ data, error: null, loading: false }))
      .catch(error => setState({ data: null, error, loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { ...state, reload: run, setData: data => setState(s => ({ ...s, data })) };
}

export function useForm(initial = {}) {
  const [values, setValues] = useState(initial);
  const set = (name, value) => setValues(v => ({ ...v, [name]: value }));
  return { values, set, setValues };
}
