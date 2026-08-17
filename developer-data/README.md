# Developer data

本目录用于保存本地开发者后台产生的 Agent、Skill、API 元数据、规则草稿、调试记录和发布版本。

当前已支持在这里保存 Agent、Skill、API 连接元数据，以及被 Git 忽略的本机密钥文件。API Key 不会进入浏览器配置、构建产物或版本管理。

`agents.json`、`skills.json` 和 `api-settings.json` 都是运行时生成的本机配置，已被 Git 忽略。首次启动开发服务器时，如果文件不存在，后台会自动创建空配置。这样可以开源后台能力，而不会上传个人模型账号、模型 ID 或调试数据。

`litellm-secrets.local` 保存本机 LiteLLM 网关的管理密钥。该文件已被 Git 忽略，不应上传或分享。
`litellm-config.local.yaml` 由开发者后台自动生成，包含网关模型配置和本机服务商密钥，同样不会进入 Git。
