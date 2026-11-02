import path from 'node:path';

// 패키지 버전이나 실행 위치가 바뀌어도 같은 OS 사용자 볼트를 재사용한다.
export function resolveUserDataPath(appDataPath: string): string {
  return path.join(appDataPath, 'InstaDesk');
}
