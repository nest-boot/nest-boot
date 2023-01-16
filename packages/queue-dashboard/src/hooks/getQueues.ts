import { useQuery } from "react-query";
import axios from "axios";
import path from "path";

export const useQueues = (refetchInterval = 10000) => {
  return useQuery({
    queryKey: ["posts"],
    queryFn: async (): Promise<Array<any>> => {
      const { data } = await axios.get(
        path.join(window.location.pathname, "/api/queues")
      );
      return data;
    },
    refetchInterval,
    refetchIntervalInBackground: true,
  });
};
