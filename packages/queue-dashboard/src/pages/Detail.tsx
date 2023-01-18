import { Tabs, TabsProps } from "antd";
import { FC } from "react";
import { useQueues } from "../hooks/getQueues";
import Overview from "./Overview";

const items: TabsProps["items"] = [
  {
    key: "overview",
    label: `Overview`,
    children: <Overview />,
  },
  {
    key: "jobs",
    label: `Jobs`,
    children: `Jobs`,
  },
  {
    key: "schedules",
    label: `Schedules`,
    children: `Schedules`,
  },
  {
    key: "workers",
    label: `Workers`,
    children: `Workers`,
  },
];

const Detail: FC = () => {
  const query = useQueues();

  return <Tabs defaultActiveKey="overview" items={items} />;
};

export default Detail;
