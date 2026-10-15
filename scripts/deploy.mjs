// Publish dist/ to the gh-pages branch (GitHub Pages serves it at https://learningaxioms.github.io/).
import { execSync } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'
const run = (cmd) => execSync(cmd, { cwd: 'dist', stdio: 'inherit' })
const remote = execSync('git remote get-url origin').toString().trim()
writeFileSync('dist/.nojekyll', '')
// Vite keeps dist/.git between builds; start from a fresh one-commit branch every time
rmSync('dist/.git', { recursive: true, force: true })
run('git init -q -b gh-pages')
run('git add -A')
run('git -c user.name="deploy" -c user.email="deploy@localhost" commit -q -m "Deploy AXIOM"')
run(`git push -f ${remote} gh-pages`)
console.log('Deployed to gh-pages.')
