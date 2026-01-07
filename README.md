# clean-deps

一个用于清除当前文件夹以及嵌套所有子文件夹下的依赖目录（如 `node_modules`）的命令行工具。

## 功能特性

- 🔍 递归扫描当前目录及所有子目录
- 📦 自动查找包含 `package.json` 和 `node_modules` 的项目
- ❓ 交互式确认删除（默认）
- ⚡ 支持自动确认模式（`-y` 参数）
- 🎨 彩色输出，清晰直观

## 安装

```bash
npm install -g clean-deps
```

或者使用 npx（无需安装）：

```bash
npx clean-deps
```

## 使用方法

### 基本用法

在项目目录下运行：

```bash
clean-deps
```

工具会扫描当前目录及所有子目录，查找包含 `package.json` 和 `node_modules` 的项目，并逐个询问是否删除。

### 自动确认删除

使用 `-y` 或 `--yes` 参数可以跳过确认，直接删除所有发现的 `node_modules`：

```bash
clean-deps -y
# 或
clean-deps --yes
```

### 查看帮助

```bash
clean-deps -h
# 或
clean-deps --help
```

### 查看版本

```bash
clean-deps -v
# 或
clean-deps --version
```

## 命令选项

| 选项 | 说明 |
|------|------|
| `-y, --yes` | 不询问，直接删除所有发现的 node_modules |
| `-v, --version` | 显示版本号 |
| `-h, --help` | 显示帮助信息 |

## 使用示例

```bash
# 交互式删除
$ clean-deps
开始扫描: /Users/username/projects
发现 ./project1 存在 node_modules, 是否执行删除（Y/n）：y
[已删除] ./project1/node_modules
发现 ./project2 存在 node_modules, 是否执行删除（Y/n）：n
[跳过] ./project2
处理完成。

# 自动删除
$ clean-deps -y
开始扫描: /Users/username/projects
[已删除] ./project1/node_modules
[已删除] ./project2/node_modules
处理完成。
```

## 注意事项

- 工具会跳过 `.git` 目录，避免影响版本控制
- 删除操作不可恢复，请谨慎使用
- 建议在删除前确保项目代码已提交到版本控制系统

## 许可证

MIT

## 作者

TaroXin

