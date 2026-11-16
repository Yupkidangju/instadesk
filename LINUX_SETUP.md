# Linux 설치 (x64·arm64)

Ubuntu 24.04의 Electron/Chromium sandbox는 root 소유·4755 권한의 `chrome-sandbox` helper가 필요합니다. 같은 버전의 아카이브와 `SHA256SUMS.txt`를 [GitHub Release](https://github.com/Yupkidangju/instadesk/releases)에서 받은 뒤 설치 전에 확인하세요. 소스 저장소의 `{{PACKAGE_NAME}}`은 패키징할 때 실제 버전·아키텍처 이름으로 바뀝니다.

```bash
set -euo pipefail
name="{{PACKAGE_NAME}}"
test -f "${name}.tar.gz"
test -f SHA256SUMS.txt
grep -F "  ${name}.tar.gz" SHA256SUMS.txt | sha256sum -c -
sudo install -d -m 0755 /opt/instadesk
sudo tar -xzf "${name}.tar.gz" -C /opt/instadesk
sudo chown -R root:root "/opt/instadesk/${name}"
sudo chmod 4755 "/opt/instadesk/${name}/chrome-sandbox"
"/opt/instadesk/${name}/InstaDesk"
```

일반 사용자 계정으로 마지막 줄을 실행하세요. `--no-sandbox`는 보안 기능을 끄므로 릴리스 실행에 사용하지 않습니다. 설치 경로가 `nosuid` 마운트이면 helper가 동작하지 않습니다. 사용자 볼트는 설치 폴더가 아닌 사용자 프로필에 저장됩니다. 다른 배포판·물리 ARM 기기에서의 동작은 별도로 확인해야 합니다.
