import { Application/*, Context*/ } from 'probot'
//const yaml = require('js-yaml')

const re = /(?:(?:resolv|clos|fix)e[ds]?|fix) +#(\d+)/ig

//couldn't get this to work, i think `getLabel` is creating the label if it doesn't exist
/*
async function ensureLabelExists(context: Context, name: string) {
    try {
        return await context.github.issues.getLabel(context.repo({
            name: name,
        }))
    } catch (e) {
        return context.github.issues.createLabel(context.repo({
            name: name,
            color: '69D100'
        }))
    }
}
*/
export = (app: Application) => {
    app.on('pull_request.closed', async (context) => {
        const pull = context.payload.pull_request
        if (!pull.merged) {
            app.log('Pull request is closed, but not merged. Stepping out...')
            return
        }
        /*
        const repo = await context.github.repos.get(context.repo())
        if (repo.data.default_branch != pull.base.ref) {
            app.log(`The pull request target branch (${pull.base.ref}) is not the repo default branch (${repo.data.default_branch}). Stepping out...`)
            return
        }
        */
        const issues = new Set<string>()
        let match = re.exec(pull.body)
        while (match) {
            issues.add(match[1])
            app.log(`Found fixed issue: #${match[1]}.`)
            match = re.exec(pull.body)
        }
        if (issues.size == 0) {
            app.log('This pull request fixes no issue. Stepping out...')
            return
        }
        const config: any = await context.config('close-label.yml')
        if (!config) {
            app.log('No label found in .github/close-label.yml. Stepping out...')
            return
        }
        for (const id of issues) {
            const issue = await context.github.issues.get(context.issue({
                number: id,
            }))
            const currentLabels = issue.data.labels.map(label => label.name)
            const labels = new Set<string>()
            for (const label of currentLabels) {
                if (labels.has(label)) {
                    labels.delete(label)
                    app.log(`Issue #${id} already has the label '${label}'. Skipping...`)
                }
                else {
                    const labelToAdd = config[label]
                    if (labelToAdd) {
                        labels.add(labelToAdd)
                        app.log(`Label '${labelToAdd}' is going to be added to issue #${id}.`)
                    }
                }
            }
            if (labels.size == 0) {
                app.log(`No label to be added to issue #${id}. Skipping...`)
                continue
            }
            const labelsToAdd = Array.from(labels)
            /*
            labelsToAdd.forEach(async label => {
                await ensureLabelExists(context, label)
            })
            */
            app.log(`Adding ${labels.size} label(s) to issue #${id}...`)
            await context.github.issues.addLabels(context.issue({
                labels: labelsToAdd,
                number: id,
            }))
            app.log(`Label(s) successfully added to issue #${id}.`)
        }
    })
}
