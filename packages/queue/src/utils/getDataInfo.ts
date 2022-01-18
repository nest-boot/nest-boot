// 获取数组最大值、最小值、中位数

const getDataInfo = (
  dataSource: number[]
): {
  min: number;
  median: number;
  max: number;
} => {
  // 正序排列
  const sortedData = dataSource.sort((a, b) => a - b);

  // 计算中位数
  let median = 0;
  const { length } = sortedData;

  if (length === 0) {
    return {
      min: 0,
      median: 0,
      max: 0,
    };
  }

  if (length % 2 === 0) {
    const firstMedianIndex = length / 2 - 1;
    const secondMedianIndex = firstMedianIndex + 1;
    median = (sortedData[firstMedianIndex] + sortedData[secondMedianIndex]) / 2;
  } else {
    median = sortedData[(length + 1) / 2 - 1];
  }

  return {
    min: sortedData[0],
    median,
    max: sortedData[length - 1],
  };
};

export default getDataInfo;
