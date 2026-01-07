#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');
const { Command } = require('commander');
const packageJson = require('./package.json');

const program = new Command();

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
  .description('用来清除当前文件夹以及嵌套所有子文件夹下的依赖目录, 如 node_modules')
  .version(packageJson.version, '-v, --version', '显示版本号')
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

      for (const dir of projects) {
        const confirmed = autoYes ? true : await shouldDelete(dir, rl, cwd);
        if (confirmed) {
          await removeNodeModules(dir, cwd);
        } else {
          console.log(
            chalk.gray(`[跳过] ${formatPath(dir, cwd)}`)
          );
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
