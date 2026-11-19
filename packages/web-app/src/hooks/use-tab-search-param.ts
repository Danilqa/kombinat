import { useLocation, useSearchParams } from 'react-router';

const TAB_PARAM = 'tab';

// The first tab is the default and keeps the URL clean. Switching replaces the history entry, so
// arrowing through the tabs does not fill the back button.
export function useTabSearchParam<Tab extends string>(
  tabs: readonly [Tab, ...Tab[]],
): [Tab, (tab: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const state: unknown = useLocation().state;
  const [defaultTab] = tabs;
  const tab = tabs.find(candidate => candidate === searchParams.get(TAB_PARAM)) ?? defaultTab;

  function setTab(next: string) {
    setSearchParams(
      params => {
        if (next === defaultTab) params.delete(TAB_PARAM);
        else params.set(TAB_PARAM, next);
        return params;
      },
      { replace: true, state },
    );
  }

  return [tab, setTab];
}
