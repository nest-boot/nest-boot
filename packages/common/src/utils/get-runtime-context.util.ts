import { RuntimeContext, runtimeContextStorage } from "../runtime-context";

export const getRuntimeContext = (): RuntimeContext =>
  runtimeContextStorage.getStore();
