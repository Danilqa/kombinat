import { createApi } from 'utils/api';

export const api = createApi({
  networkErrorMessage: "Can't reach the daemon. Check that it's running.",
});
