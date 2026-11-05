import { getFormProps } from '@conform-to/react'
import { useApiForm } from '@/hooks/useApiForm'
import { TEAM_NAME, USERS, type GranteeId } from '@/lib/constants'
import { otherGrantee } from '@/lib/context'
import { memberActionSchema } from '@/lib/schemas'
import type { TeamSummary } from '@/lib/types'
import { Badge } from './Badge'
import { Button } from './Button'
import { FormMessages } from './FormMessages'

type Props = {
  team: TeamSummary
  /** The user the page is viewing as. */
  viewer: GranteeId
  onChange: () => void
  /** Called after a member is added or removed, so the page refetches their access. */
  onChanged: () => void
}

/**
 * Step 4: the team's members against its seats, with controls to add the
 * other demo user to the group or remove a member. Only rendered for a
 * member of the group, and the API refuses changes from anyone else.
 */
export function TeamMembers({ team, viewer, onChange, onChanged }: Props) {
  const other = otherGrantee(viewer)
  const otherIsMember = team.members.some((m) => m.granteeId === other)
  const full = team.seats != null && team.members.length >= team.seats

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge tone={team.seats == null ? 'zinc' : full ? 'amber' : 'green'}>
          {team.members.length} of {team.seats ?? '?'} seats used
        </Badge>
        <span className="text-zinc-500">
          Group <span className="font-mono text-xs">{team.groupId}</span>
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-zinc-500">
            <tr className="border-b border-black/10 dark:border-white/15">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Grantee</th>
              <th className="py-2 pr-4 font-medium">Joined</th>
              <th className="py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {team.members.map((member) => (
              <tr
                key={member.granteeId}
                className="border-b border-black/5 last:border-0 dark:border-white/10"
              >
                <td className="py-2 pr-4">
                  <span className="inline-flex items-center gap-2">
                    {displayName(member)}
                    {member.granteeId === viewer ? (
                      <Badge tone="zinc">You</Badge>
                    ) : null}
                  </span>
                </td>
                <td className="py-2 pr-4 font-mono text-xs">
                  {member.granteeId}
                </td>
                <td className="py-2 pr-4" suppressHydrationWarning>
                  {member.joinedAt
                    ? new Date(member.joinedAt).toLocaleString()
                    : '—'}
                </td>
                <td className="py-2 text-right">
                  {member.granteeId !== viewer ? (
                    <MemberActionForm
                      action="remove"
                      viewer={viewer}
                      granteeId={member.granteeId}
                      onChange={onChange}
                      onChanged={onChanged}
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {otherIsMember ? (
        <p className="text-sm text-zinc-500">
          Both demo users are in {TEAM_NAME}.
        </p>
      ) : (
        <MemberActionForm
          action="add"
          viewer={viewer}
          granteeId={other}
          disabled={full}
          hint={
            full
              ? `Every seat is taken. Remove a member to free one; Salable rejects the add otherwise.`
              : `Adds ${USERS[other].name} to the group. They receive the Team plan's entitlements straight away, with no checkout.`
          }
          onChange={onChange}
          onChanged={onChanged}
        />
      )}
    </div>
  )
}

/**
 * One add or remove action. Its own component because each row owns a form
 * hook.
 */
function MemberActionForm({
  action,
  viewer,
  granteeId,
  disabled = false,
  hint,
  onChange,
  onChanged,
}: {
  action: 'add' | 'remove'
  viewer: GranteeId
  granteeId: GranteeId | string
  disabled?: boolean
  hint?: string
  onChange: () => void
  onChanged: () => void
}) {
  const name = isDemoUser(granteeId) ? USERS[granteeId].name : granteeId

  const { form, fields, pending, message } = useApiForm({
    schema: memberActionSchema,
    action: '/api/group/members',
    confirm:
      action === 'remove'
        ? `Remove ${name} from ${TEAM_NAME}? They lose the Team plan's entitlements immediately.`
        : undefined,
    onSuccess: () => {
      onChange()
      onChanged()
    },
    // A rejected action (e.g. the seat limit) means our view is stale, so
    // re-sync.
    onError: onChange,
  })

  return (
    <form
      {...getFormProps(form)}
      noValidate
      className={action === 'add' ? 'space-y-2' : 'inline-block'}
    >
      <input type="hidden" name={fields.viewer.name} value={viewer} />
      <input type="hidden" name={fields.granteeId.name} value={granteeId} />
      <input type="hidden" name={fields.action.name} value={action} />
      {action === 'add' ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              disabled={disabled}
              pending={pending}
              pendingLabel="Adding…"
            >
              Add {name}
            </Button>
            {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
          </div>
          <FormMessages
            errors={form.errors}
            errorId={form.errorId}
            message={message}
          />
        </>
      ) : (
        <>
          <Button
            type="submit"
            variant="danger"
            pending={pending}
            pendingLabel="Removing…"
            className="px-2 py-1 text-xs"
          >
            Remove
          </Button>
          {form.errors?.length ? (
            <p
              id={form.errorId}
              role="alert"
              className="mt-1 text-xs text-red-600 dark:text-red-400"
            >
              {form.errors.join(' ')}
            </p>
          ) : null}
        </>
      )}
    </form>
  )
}

/**
 * Checkout creates the buyer's grantee without a name, so fall back to the
 * name this app knows the user by.
 */
function displayName(member: { granteeId: string; name: string | null }) {
  if (member.name) return member.name
  return isDemoUser(member.granteeId) ? USERS[member.granteeId].name : '—'
}

function isDemoUser(id: string): id is GranteeId {
  return id in USERS
}
