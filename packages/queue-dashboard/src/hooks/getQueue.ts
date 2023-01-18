import { useQuery } from "react-query";
import axios from "axios";
import path from "path";

export const useQueues = (name?: string, refetchInterval = 10000) => {
  return useQuery({
    queryKey: ["post", name],
    queryFn: async (): Promise<any> => {
      const { data } = await axios.get(
        path.join(window.location.pathname, `/api/queues/${name}`)
      );
      return data;
    },
    refetchInterval,
    refetchIntervalInBackground: true,
    enabled: !!name,
  });
};
