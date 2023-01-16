import React from "react";
import { Table } from "antd";
import { FC } from "react";
import { Link } from "react-router-dom";
import { useQueues } from "../hooks/getQueues";

const List: FC = () => {
  const query = useQueues();

  return (
    <Table
      columns={[
        {
          title: "Name",
          dataIndex: "name",
          render: (name: string) => <Link to={name}>{name}</Link>,
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
        {
          title: "Status",
          dataIndex: "status",
        },
      ]}
      dataSource={query?.data}
      pagination={false}
    />
  );
};

export default List;
