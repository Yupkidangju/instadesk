# Linux 설치 (x64·arm64)

Ubuntu 24.04의 Electron/Chromium sandbox는 root 소유·4755 권한의 `chrome-sandbox` helper가 필요합니다. 아카이브를 신뢰할 수 있는 [GitHub Release](https://github.com/Yupkidangju/instadesk/releases)에서 받고 SHA-256을 확인한 뒤 설치하세요.

```bash
name="InstaDesk-2.1.0-linux-$(uname -m | sed 's/x86_64/x64/; s/aarch64/arm64/')"
grep "${name}.tar.gz" SHA256SUMS.txt | sha256sum -c -
sudo install -d -m 0755 /opt/instadesk
sudo tar -xzf "${name}.tar.gz" -C /opt/instadesk
sudo chown -R root:root "/opt/instadesk/${name}"
sudo chmod 4755 "/opt/instadesk/${name}/chrome-sandbox"
"/opt/instadesk/${name}/InstaDesk"
```

일반 사용자 계정으로 마지막 줄을 실행하세요. `--no-sandbox`는 보안 기능을 끄므로 릴리스 실행에 사용하지 않습니다. 설치 경로가 `nosuid` 마운트이면 helper가 동작하지 않습니다. 사용자 볼트는 설치 폴더가 아닌 사용자 프로필에 저장됩니다. 다른 배포판·물리 ARM 기기에서의 동작은 별도로 확인해야 합니다.
