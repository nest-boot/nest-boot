import { Descriptions, Spin } from "antd";
import { FC } from "react";
import { useParams } from "react-router-dom";
import { useQueues } from "../hooks/getQueue";
import bytes from "bytes";

const Overview: FC = () => {
  const { name } = useParams();
  const query = useQueues(name);

  if (query.isLoading) {
    return <Spin />;
  }

  return (
    <Descriptions bordered layout="vertical">
      <Descriptions.Item label="Name">{query.data.name}</Descriptions.Item>
      <Descriptions.Item label="Status">{query.data.status}</Descriptions.Item>
      <Descriptions.Item label="Worker Count">
        {query.data.workers.length}
      </Descriptions.Item>
      <Descriptions.Item label="Redis Version">
        {query.data.client.redisVersion}
      </Descriptions.Item>
      <Descriptions.Item label="Redis Memory">
        {query.data.client.maxMemory > 0
          ? `${bytes(query.data.client.usedMemory)}/${bytes(
              query.data.client.maxMemory
            )}(${(
              (query.data.client.usedMemory / query.data.client.maxMemory) *
              100
            ).toFixed(2)}%)`
          : bytes(query.data.client.usedMemory)}
      </Descriptions.Item>
      <Descriptions.Item label="Redis Connection">
        {`${query.data.client.usedConnection}/${
          query.data.client.maxConnection
        }(${(
          (query.data.client.usedConnection / query.data.client.maxConnection) *
          100
        ).toFixed(2)}%)`}
      </Descriptions.Item>
    </Descriptions>
  );
};

export default Overview;
