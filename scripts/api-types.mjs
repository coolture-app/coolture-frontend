// npm runs scripts in cmd.exe on Windows, where a shell default such as ${COOLTURE_AWS:-...} doesn't work.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const aws = resolve(process.env.COOLTURE_AWS ?? '../coolture-aws');
const cli = resolve(
  dirname(createRequire(import.meta.url).resolve('openapi-typescript/package.json')),
  'bin/cli.js',
);
const contracts = {
  'feed-api': 'aws/lambdas/post-read/contracts/feed-api.yaml',
  'users-api': 'aws/lambdas/user/contracts/users-api.yaml',
};

console.log(`Contracts from ${aws}`);
for (const [name, contract] of Object.entries(contracts)) {
  execFileSync(
    process.execPath,
    [cli, resolve(aws, contract), '-o', `src/app/core/models/generated/${name}.d.ts`],
    { stdio: 'inherit' },
  );
}
