#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');
const { Command } = require('commander');
const packageJson = require('./package.json');

const program = new Command();

async function isMonorepo(rootDir) {
  // 首先检查是否有 pnpm-workspace.yaml（pnpm 的 monorepo 标识）
  const pnpmWorkspacePath = path.join(rootDir, 'pnpm-workspace.yaml');
  try {
    await fs.promises.access(pnpmWorkspacePath);
    return true;
  } catch {
    // 文件不存在，继续检查
  }

  // 检查 package.json
  const packageJsonPath = path.join(rootDir, 'package.json');
  try {
    const packageJsonContent = await fs.promises.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    // 检查是否有 workspaces 字段（支持 npm/yarn/pnpm）
    if (packageJson.workspaces) {
      return true;
    }

    // 检查是否有 pnpm.workspaces 字段（pnpm 的另一种配置方式）
    if (packageJson.pnpm && packageJson.pnpm.workspaces) {
      return true;
    }
  } catch (err) {
    // package.json 不存在或解析失败，继续检查其他标识
  }

  // 检查是否有 lerna.json
  const lernaPath = path.join(rootDir, 'lerna.json');
  try {
    await fs.promises.access(lernaPath);
    return true;
  } catch {
    // 文件不存在
  }

  return false;
}

async function findProjectsWithNodeModules(rootDir) {
  const projects = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries;

    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch (err) {
      console.log(
        chalk.red(`[跳过] 无法访问 ${current}: ${err.message}`)
      );
      continue;
    }

    const hasPackageJson = entries.some(
      (entry) => entry.isFile() && entry.name === 'package.json'
    );
    const hasNodeModules = entries.some(
      (entry) => entry.isDirectory() && entry.name === 'node_modules'
    );

    if (hasPackageJson && hasNodeModules) {
      projects.push(current);
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      stack.push(path.join(current, entry.name));
    }
  }

  return projects;
}

function createPrompt() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function formatPath(dir, currentWorkingDir) {
  const relative = path.relative(currentWorkingDir, dir) || '.';
  return relative.startsWith('.') ? dir : `./${relative}`;
}

async function shouldDelete(dir, rl, currentWorkingDir) {
  const question = chalk.yellow(
    `发现 ${formatPath(dir, currentWorkingDir)} 存在 node_modules, 是否执行删除（Y/n）：`
  );

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      const trimmed = answer.trim();
      if (trimmed === '' || /^[yY]$/.test(trimmed)) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

async function shouldDeleteMonorepo(rootDir, projectCount, rl, currentWorkingDir) {
  const question = chalk.yellow(
    `发现 ${formatPath(rootDir, currentWorkingDir)} 是一个 monorepo，共找到 ${projectCount} 个项目包含 node_modules，是否全部删除（Y/n）：`
  );

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      const trimmed = answer.trim();
      if (trimmed === '' || /^[yY]$/.test(trimmed)) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

async function removeNodeModules(dir, currentWorkingDir) {
  const target = path.join(dir, 'node_modules');
  try {
    await fs.promises.rm(target, { recursive: true, force: true });
    console.log(
      chalk.green(`[已删除] ${formatPath(target, currentWorkingDir)}`)
    );
  } catch (err) {
    console.log(
      chalk.red(`[失败] 删除 ${formatPath(target, currentWorkingDir)} 时出错: ${err.message}`)
    );
  }
}

program
  .name('clean-node-deps')
  .description(packageJson.description)
  .version(packageJson.version, '-v, --version', '显示版本号')
  .option('-c, --clean', '执行清除操作（默认行为）')
  .option('-y, --yes', '不询问，直接删除所有发现的 node_modules')
  .action(async (options) => {
    const cwd = process.cwd();
    const autoYes = options.yes || false;

    async function main() {
      console.log(chalk.cyan(`开始扫描: ${cwd}`));
      const projects = await findProjectsWithNodeModules(cwd);

      if (projects.length === 0) {
        console.log(chalk.green('未发现包含 node_modules 的项目。'));
        return;
      }

      const rl = autoYes ? null : createPrompt();

      // 用于跟踪已处理的 monorepo 根目录，避免重复处理
      const processedMonorepos = new Set();
      const processedProjects = new Set();

      for (const dir of projects) {
        // 如果这个项目已经在某个 monorepo 中被处理过，跳过
        if (processedProjects.has(dir)) {
          continue;
        }

        // 检查当前项目目录是否是 monorepo
        const isMonorepoRoot = await isMonorepo(dir);

        if (isMonorepoRoot && !processedMonorepos.has(dir)) {
          // 找到这个 monorepo 下的所有子项目的 node_modules
          const monorepoProjects = projects.filter(p => {
            // 检查项目是否在这个 monorepo 目录下（包括 monorepo 根目录本身）
            if (p === dir) return true;
            const relative = path.relative(dir, p);
            return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
          });

          processedMonorepos.add(dir);
          monorepoProjects.forEach(p => processedProjects.add(p));

          // 只询问一次这个 monorepo
          const confirmed = autoYes ? true : await shouldDeleteMonorepo(dir, monorepoProjects.length, rl, cwd);
          if (confirmed) {
            for (const projectDir of monorepoProjects) {
              await removeNodeModules(projectDir, cwd);
            }
          } else {
            console.log(chalk.gray(`[跳过] monorepo: ${formatPath(dir, cwd)}`));
          }
        } else {
          // 非 monorepo 或已处理过的项目，逐个询问
          if (!processedProjects.has(dir)) {
            processedProjects.add(dir);
            const confirmed = autoYes ? true : await shouldDelete(dir, rl, cwd);
            if (confirmed) {
              await removeNodeModules(dir, cwd);
            } else {
              console.log(
                chalk.gray(`[跳过] ${formatPath(dir, cwd)}`)
              );
            }
          }
        }
      }

      if (rl) rl.close();
      console.log(chalk.cyan('处理完成。'));
    }

    try {
      await main();
    } catch (err) {
      console.error(chalk.red(`执行失败: ${err.message}`));
      process.exit(1);
    }
  });

program.parse();
