import React from "react";
import { Table } from "antd";
import { QueryClient, QueryClientProvider } from "react-query";
import { FC } from "react";

const queryClient = new QueryClient();

const List: FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Table
        columns={[
          {
            title: "Name",
            dataIndex: "name",
          },
          {
            title: "Waiting",
            dataIndex: "wait",
          },
          {
            title: "Active",
            dataIndex: "active",
          },
          {
            title: "Delayed",
            dataIndex: "delayed",
          },
          {
            title: "Paused",
            dataIndex: "paused",
          },
        ]}
        dataSource={[
          {
            name: "John Doe",
          },
        ]}
      />
    </QueryClientProvider>
  );
};

export default List;
