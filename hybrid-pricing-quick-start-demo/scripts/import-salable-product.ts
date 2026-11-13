import yaml from 'js-yaml'
import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { Salable } from '@salable/sdk'

const SALABLE_SECRET_KEY = process.env.SALABLE_SECRET_KEY
if (!SALABLE_SECRET_KEY) {
  throw new Error('Please add SALABLE_SECRET_KEY to your .env.local')
}

const salable = new Salable(SALABLE_SECRET_KEY)

const targetPath = join(__dirname, '../product.yaml')

async function importSalableProduct() {
  let fileContents: string
  try {
    fileContents = await readFile(targetPath, 'utf-8')
    yaml.load(fileContents)
  } catch (error) {
    console.error(`Failed to read or parse ${targetPath}`)
    console.error(error)
    process.exit(1)
  }

  const fileName = basename(targetPath)
  const form = new FormData()
  form.append(
    'file',
    new Blob([fileContents], { type: 'application/yaml' }),
    fileName
  )

  const response = await fetch('https://salable.app/api/products/import', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SALABLE_SECRET_KEY}` },
    body: form,
  })

  if (!response.ok) {
    console.error(
      `Salable rejected the import: ${response.status} ${response.statusText}`
    )
    console.error(await response.text())
    process.exit(1)
  }

  console.log(`Imported ${fileName} into Salable`)

  const data = await salable.api.products.get({
    queryParameters: { search: 'Notes Hybrid', expand: ['plans'] },
  })

  if (!data?.data?.length) {
    console.log(
      'Unable to retrieve imported Salable product, please check the dashboard'
    )
    process.exit(1)
  }

  const plans = data.data[0]?.plans?.data

  const personalPlanId = plans?.find(({ name }) => name === 'Personal')?.id
  const teamPlanId = plans?.find(({ name }) => name === 'Team')?.id

  if (!personalPlanId && !teamPlanId) {
    console.log(
      'Unable to retrieve imported Salable plans, please check the dashboard'
    )
    process.exit(1)
  }

  let envs = `
Please copy the below ENVs into your .env.local file:
`
  if (personalPlanId) {
    envs = `${envs}
SALABLE_PERSONAL_PLAN_ID=${personalPlanId}`
  }

  if (teamPlanId) {
    envs = `${envs}
SALABLE_TEAM_PLAN_ID=${teamPlanId}`
  }

  console.log(envs)
}

importSalableProduct()
