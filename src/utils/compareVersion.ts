/**
 * 比较两个语义化版本号。
 *
 * @param left 左侧版本号
 * @param right 右侧版本号
 * @returns 1 表示 left > right，-1 表示 left < right，0 表示相等
 */
export function compareVersion(left: string, right: string): -1 | 0 | 1 {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)
  const maxLength = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] || 0
    const rightValue = rightParts[index] || 0

    if (leftValue > rightValue) {
      return 1
    }

    if (leftValue < rightValue) {
      return -1
    }
  }

  return 0
}
