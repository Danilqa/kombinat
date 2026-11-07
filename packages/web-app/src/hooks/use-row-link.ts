import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router';

type RowClickHandler = (event: MouseEvent<HTMLTableRowElement>) => void;

// Makes a whole table row open a page. Not a link stretched over the row: Safari ignores
// position: relative on <tr>, so every row's link would cover the whole table.
export function useRowLink(): (to: string) => RowClickHandler {
  const navigate = useNavigate();
  return to => event => {
    if (event.target instanceof Element && event.target.closest('a, button')) return;
    if (window.getSelection()?.isCollapsed === false) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey) {
      window.open(to, '_blank', 'noopener');
      return;
    }
    void navigate(to);
  };
}
