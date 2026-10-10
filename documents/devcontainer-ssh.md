# WSLのSSHエージェントをコンテナで利用する

WSL内のDocker Engineと, Windows側のVS Codeを利用する場合の任意設定. WSLの秘密鍵をSSHエージェントへ登録し, ソケットだけをコンテナへ共有する. チーム共通のComposeとDev Container設定は変更しない.

## 個人設定の準備

以下のホスト側コマンドはすべてWSLのターミナルで実行する. Windows側のPowerShellやコンテナ内では実行しない. リポジトリルートへ移動してから作業する.

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
ssh-add -l
test -S "$SSH_AUTH_SOCK"
id -u
```

鍵名は実際のものに置き換える. ソケットの所有者であるWSLユーザーとコンテナの `node` ユーザーのUIDが一致していることを確認する. コンテナ側のUIDは既存コンテナのターミナルで `id -u` を実行して確認できる. 異なる場合はここで止め, ユーザー設定を調整する. ソケットのアクセス権を全ユーザーへ開放しない.

[環境変数の例](examples/devcontainer-ssh/env.example)に従い, `.devcontainer/.env` に次の値を追加する. ファイルが既にある場合は他の設定を保持し, 同名の設定があればその値だけ更新する.

```dotenv
WSL_SSH_AUTH_SOCK=/tmp/ssh-example/agent.1234
```

値はWSLで `echo "$SSH_AUTH_SOCK"` を実行して表示された実際の絶対パスに置き換える. 秘密鍵の内容やパスフレーズは `.env` に書かない. エージェントを再起動するとソケットパスが変わるため, この値を更新してコンテナを再作成する.

[overrideの例](examples/devcontainer-ssh/compose.override.yaml)を個人用ファイルへコピーする. 同名のファイルが既にある場合は上書きせず内容を確認する.

```bash
cp -n documents/examples/devcontainer-ssh/compose.override.yaml \
  .devcontainer/compose.override.yaml
```

`.devcontainer/.env` と `.devcontainer/compose.override.yaml` は既存の `.gitignore` で管理対象外になる. Composeは `compose.yaml` に加えて, 同じ場所にある `compose.override.yaml` と `.env` を自動で読み込む. overrideを作成しないメンバーにはSSH設定は適用されない.

## WSLから起動してWindowsのVS Codeで接続する

既存のDev Containerウィンドウを閉じる. 同じサービスのコンテナは再作成されるため, コンテナ内だけに保存した必要なファイルは先に保存する. リポジトリルートから `.devcontainer` に移動してComposeを実行する.

```bash
cd .devcontainer
docker compose config --quiet

docker compose up -d --build --force-recreate

docker compose ps
```

`.devcontainer/.env` はComposeが自動で読み込む. `WSL_SSH_AUTH_SOCK` が未設定または空ならoverrideの読み込みを失敗させる. マウント元が存在しない場合にディレクトリを自動作成しない.

Windows側のVS Codeで `Dev Containers: Attach to Running Container...` を実行し, 上記の `ps` で確認したコンテナを選択する. `/workspace` を開く. Windows側のDocker CLIも同じWSLのDocker Engineへ接続できる必要がある. コンテナが一覧に出ない場合はDocker接続先を確認する. 認証なしのTCP公開で回避しない.

この手順では共通の `devcontainer.json` から `Reopen in Container` や `Rebuild Container` を実行しない. 共通設定は個人用overrideを読み込まないためである. 再作成は上記のWSLコマンドで行う. 起動済みコンテナへのAttachでは共通設定の `postCreateCommand` は実行されないため, 新規環境で必要な場合は `/workspace` で `npm install` を実行する.

## 認証の確認

接続したコンテナのターミナルで実行する.

```bash
echo "$SSH_AUTH_SOCK"
test -S "$SSH_AUTH_SOCK"
ssh-add -l
ssh -T git@github.com
```

`SSH_AUTH_SOCK` が `/run/host-ssh-agent.sock` になり, WSLで登録した鍵が表示されることを確認する. GitHubの初回接続時はホスト鍵を公式の公開情報と照合する. GitHubは認証成功時もシェルを提供せず, `ssh -T` の終了コードは1になるため, 認証成功のメッセージで判断する. 確認後に人間が `git fetch` を実行する.

エージェントに接続できない場合はWSLのエージェント稼働, `.env` のパス, ソケットの所有者とコンテナのUIDを確認する. 鍵が表示されるのにGitHub認証が失敗する場合は, 鍵のGitHub登録と対象リポジトリへの権限を確認する.

## 参照

- [Docker Composeの複数ファイルの自動読み込み](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/)
- [Docker Composeの事前定義環境変数](https://docs.docker.com/compose/how-tos/environment-variables/envvars/)
- [Docker Composeの環境変数展開](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)
- [Docker Composeのbind mount設定](https://docs.docker.com/reference/compose-file/services/#volumes)
- [VS Codeで起動済みコンテナへ接続する](https://code.visualstudio.com/docs/devcontainers/attach-container)
- [GitHubのSSH接続テスト](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/testing-your-ssh-connection)
- [GitHubのSSH鍵フィンガープリント](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints)
