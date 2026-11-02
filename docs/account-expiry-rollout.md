# 账号有效期：变更与上线手册

本次上线只需执行 `schema-reference/supabase_account_expiry.sql`。已确认当前数据桶为私有桶，存储策略查询为空，本次不涉及桶配置或存储权限变更。

## 行为与兼容性

- `profiles.access_expires_at IS NULL` 表示长期有效；老账号不回填期限。
- 7 天为 168 小时，30 天为 720 小时；UTC 存储，管理界面显示浏览器时区。
- 设置从操作时开始；续期从 `max(当前期限, 当前时间)` 开始。长期账号需先设置期限，不能直接续期。
- 保留 invited/active/disabled 状态；到期独立计算。续期不启用账号，启用不续期。
- Manager 只能设置自己邀请的 viewer；Admin 可设置其他 manager/viewer。不得设置自己的期限，Admin 账号不设置期限。升为 Admin 前须先移除期限。
- Manager 设置的具体期限不能超过自己的期限；不级联停用下属。
- 旧邀请请求省略 accessDays 时仍长期有效（包括 Manager）；显式 null 仅 Admin 可用。严格限制所有 Manager 新邀请必须有限期属于后续不兼容变更。
- 旧 PATCH 请求省略 expiry 不改变期限；邀请配额仍计入过期账号。
- 新邀请在数据库触发器中标为 access_setup_pending，归属及期限成功保存后才解除。失败时 API 返回错误且阻止访问；删除该未激活账号后重新邀请。旧版邀请没有此标记，行为不变。
- 账号激活只允许 invited → active，不解除 disabled，不清空期限。
- 服务端每次请求检查状态和期限；已打开页面每 30 秒、恢复窗口焦点或到期时重新检查。已下载的数据不能撤回。
- 生产环境的新版本必须在数据库迁移后部署；缺失字段或读取失败将拒绝业务访问。
- 仅 local dev（NODE_ENV=development），且 ACCOUNT_EXPIRY_MANAGEMENT_ENABLED 未设为 true，并且两个新增字段都不存在时，允许按旧结构登录和读取业务数据。禁用/未激活状态仍检查；部分迁移、已有期限、生产环境和数据库读取失败均不会绕过校验。管理账号及启用期限功能仍需先执行迁移。
- 密码、OTP 或 MFA 成功后，登录页先检查 /api/auth/me；访问被拒绝时显示原因，不再无提示跳回登录页。

## 接口

POST /api/admin/users: 可选 `accessDays: 7 | 30 | null`，省略保持兼容。

PATCH /api/admin/users/:id: `{ "expiry": { "action": "set" | "extend" | "unlimited", "days": 7 | 30, "requestId": "UUID" } }`。
unlimited 省略 days；expiry 不能与 role/status 混合提交。同一次操作重试必须复用 requestId。

数据库 change_account_access 仅 service_role 可执行，操作者 ID 必须来自服务端已验证会话。行锁串行处理同一账号更新；更新和 account_access_log 日志在同一事务。日志保留用户 ID，不随账号删除级联删除。

## 本地验证

1. `node --test tests/account-access.test.ts tests/account-expiry-routes.test.cjs`（Node 22.18+ 或 24）。
2. `npx tsc --noEmit`、`npm run build`。
3. `tests/account-expiry.sql` 只能在全新、一次性的本地 PostgreSQL 数据库运行：`psql -v ON_ERROR_STOP=1 -d <test_database> -f tests/account-expiry.sql`。脚本创建模拟 auth 表和角色，绝不能对生产执行。
4. 对本次修改文件运行 ESLint；项目全量 lint 的已有错误应单独处理。

## 预发布与生产顺序

1. 记录当前发布版本，确认数据库备份/恢复点及目标 Supabase 项目。不要输出或提交密钥。
2. 先在预发布执行 `schema-reference/supabase_account_expiry.sql`。生产按相同顺序执行；其前置条件为现有 profiles、邀请和 manager 迁移已完成。已有环境无需重跑历史迁移，也不要执行 `tests/` 下的 SQL。
3. 核对旧账号 access_expires_at 均为 NULL、access_setup_pending 为 false；旧版应用登录、邀请、禁用仍正常。
4. 部署新代码，ACCOUNT_EXPIRY_MANAGEMENT_ENABLED=false。这个开关仅隐藏/禁用期限管理，不关闭过期校验。所有应用实例必须完成更新后才启用入口。
5. 预发布通过 SQL 为专用测试账号设置几分钟后的到期时间，完成以下人工端到端验收，再在生产用专用账号冒烟：
   - 老账号/MFA 正常登录，邀请激活、密码重设不改变期限。
   - Manager 只能管理自己的 viewer，7/30 天创建和续期正常。
   - 保持登录等到到期，访问 /api/domains、/api/listings/top-products、/api/social-media 和 /api/copilot/chat 均被拒绝，页面跳转 /auth/expired。
   - 刷新、重新登录、换浏览器均不能绕过；续期后 Check access again 恢复访问。
   - 续期 disabled 账号仍不可访问；重设密码不解除禁用。
   - 合法 Admin 上传、发布、下载仍正常（包括签名上传）。
   - 拒绝向 authenticated/anon 开放 change_account_access RPC 或 account_access_log。
   - 模拟邀请保存失败：账号显示 setup incomplete，激活接口拒绝访问；管理员可删除并重新邀请。
6. 所有验证通过后设置 ACCOUNT_EXPIRY_MANAGEMENT_ENABLED=true 并重新部署。观察 401/403/503、邀请失败和 account_access_log。

## 回滚

- 尚未产生期限：可回滚旧应用，保留新增数据库字段/日志；待处理邀请仍需清理。
- 已产生期限：关闭 ACCOUNT_EXPIRY_MANAGEMENT_ENABLED，保留到期鉴权及数据库迁移；修复或回滚管理界面/写接口。
- 不能直接回退到完全不识别期限的旧版本，否则到期用户可能恢复访问。
- 不删除到期记录及操作日志。

## 上线证据

本地构建、单元/API 模拟测试和隔离 PostgreSQL 测试不等同于真实 Supabase 联调。执行人须在上线记录补齐预发布登录/MFA/邀请邮件、存储签名上传及上述浏览器场景的结果。仓库不包含生产凭证，也不自动执行生产迁移或部署。

## 本次本地验证记录（2026-11-01 至 2026-11-02）

- 21 项访问策略和实际路由源码的模拟接口测试通过，包含 local dev 未迁移兼容与生产环境拒绝未迁移结构的回归测试。
- 隔离 PostgreSQL：迁移重复执行、旧账号兼容、权限、期限计算、幂等日志、禁用保持、Manager 期限上限均通过。
- TypeScript 检查及 Next.js 生产构建通过。
- 真实 Supabase 邀请邮件/MFA/签名上传及完整浏览器端到端验收尚未执行；未运行生产迁移或部署。

## 当前连接的数据桶核查（2026-11-02）

- 本地配置指向的数据桶为 `asop_pharmdash_data`，Storage API 返回 `public=false`。
- 使用项目 publishable key 匿名列出 channels、releases、audit，均无可见文件。
- 对管理员确认存在的渠道文件、发布数据、审计文件，公开 URL 和匿名下载入口均未返回文件。
- 仓库数据读取经服务端 service-role 客户端；浏览器上传使用管理员接口签发的上传令牌。
- 用户在 Supabase SQL Editor 执行策略查询并确认结果为空（storage.objects / storage.buckets 无策略记录）。
- 结论：当前环境无需修改桶配置或新增存储策略。已移除本次新增的存储加固 SQL、临时检查 SQL 及对应测试；未修改远端桶或策略。
