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
    queryParameters: { search: 'Starter', expand: ['plans'] },
  })

  if (!data?.data?.length) {
    console.log(
      'Unable to retrieve imported Salable product, please check the dashboard'
    )
    process.exit(1)
  }

  const plans = data.data[0]?.plans?.data

  const starterPlanId = plans?.find(({ name }) => name === 'Starter')?.id
  const topUpPlanId = plans?.find(({ name }) => name === 'Token Top-Up')?.id

  if (!starterPlanId && !topUpPlanId) {
    console.log(
      'Unable to retrieve imported Salable plans, please check the dashboard'
    )
    process.exit(1)
  }

  let envs = `
Please copy the below ENVs into your .env.local file:
`
  if (starterPlanId) {
    envs = `${envs}
SALABLE_STARTER_PLAN_ID=${starterPlanId}`
  }

  if (topUpPlanId) {
    envs = `${envs}
SALABLE_TOP_UP_PLAN_ID=${topUpPlanId}`
  }

  console.log(envs)
}

importSalableProduct()
