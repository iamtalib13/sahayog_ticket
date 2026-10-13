<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Avatar,
  Badge,
  Button,
  DesktopShell,
  Dialog,
  ErrorMessage,
  PageHeader,
  PageHeaderTitle,
  ScrollArea,
  Select,
  Sidebar,
  SidebarCollapseToggle,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  TabButtons,
  Textarea,
  TextInput,
} from 'frappe-ui'
import {
  List,
  ListCell,
  ListHeader,
  ListHeaderCell,
  ListRow,
  ListRows,
} from 'frappe-ui/list'
import { useCall } from 'frappe-ui'
import CreateServiceDialog from '../components/CreateServiceDialog.vue'

const API = 'sahayog_ticket.sahayog_ticket.page.account_service.account_service_api'
// Boot data comes as window globals (vite plugin): window["user"], window["csrf_token"]
const boot: any = { user: (window as any).user || 'Guest' }
const isGuest = !boot.user || boot.user === 'Guest'

// ---- tabs + column search ----
const tab = ref('all') // all | pending | closed
const rp = ref<string | null>(null) // Pending Operations | Pending Branch | Resolved | null
const qId = ref('')
const qCustomer = ref('')
const qAccount = ref('')
const showCreate = ref(false)

const dashboard = useCall<any, Record<string, any>>({
  url: `/api/v2/method/${API}.get_dashboard_data`,
  params: () => ({
    view: 'all',
    tab: tab.value,
    q_id: qId.value || undefined,
    q_customer: qCustomer.value || undefined,
    q_account: qAccount.value || undefined,
    rp: rp.value || undefined,
  }),
  refetch: true,
  initialData: { role: 'branch', counters: [], tickets: [], total: 0, tabs: {}, options: {} } as any,
})

const role = computed(() => (dashboard.data as any)?.role || 'branch')
const tickets = computed((): any[] => (dashboard.data as any)?.tickets || [])
const total = computed(() => (dashboard.data as any)?.total ?? 0)
const tabs = computed((): any => (dashboard.data as any)?.tabs || {})
const options = computed((): any => (dashboard.data as any)?.options || { departments: [], service_types: [], agents: [] })
const roleName: Record<string, string> = { branch: 'Branch User', cpc: 'CPC Loan User', helpdesk: 'Contact Service' }

function pickTab(t: string) {
  tab.value = t
}
function pickRp(value: string) {
  rp.value = rp.value === value ? null : value
}
function resetFilters() {
  tab.value = 'all'
  rp.value = null
  qId.value = ''
  qCustomer.value = ''
  qAccount.value = ''
}

// ---- row mapping ----
function fmtDate(dt: string): string {
  if (!dt) return '—'
  const d = String(dt).slice(0, 10).split('-') // yyyy-mm-dd
  if (d.length !== 3) return String(dt).slice(0, 10)
  return `${d[2]}-${d[1]}-${d[0]}` // dd-mm-yyyy
}
function relTime(dt: string): string {
  if (!dt) return '—'
  const mins = Math.max(1, Math.round((Date.now() - new Date(String(dt).replace(' ', 'T')).getTime()) / 60000))
  if (mins < 60) return `${mins}m ago`
  const h = Math.round(mins / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}
const rows = computed(() =>
  tickets.value.map((t: any) => ({
    ...t,
    customerLine: t.customer_name || t.employee_name || '',
    slaDue: t.due_time ? fmtDate(t.due_time) : `TAT ${t.tat || '-'}`,
    lastAction: t.last_action_by
      ? `${String(t.last_action_by).split('@')[0]} · ${relTime(t.last_action_on)}`
      : '',
  })),
)

const statusDot: Record<string, string> = {
  Open: 'bg-surface-red-7',
  'In-Progress': 'bg-surface-blue-7',
  Resolved: 'bg-surface-green-7',
  Closed: 'bg-surface-gray-4',
}
function pendingFrom(t: any): { label: string; theme: any } | null {
  if (t.turn === 'done') return { label: 'Done', theme: 'gray' }
  if (t.turn === 'helpdesk') return { label: 'Contact Service', theme: 'violet' }
  if (t.turn === 'branch') return { label: 'Branch User', theme: 'amber' }
  return { label: 'CPC User', theme: 'blue' }
}

const selection = ref<any[]>([])

// ---- buttons only for the turn holder (no confusion) ----
function actionsFor(t: any): { key: string; label: string; solid?: boolean }[] {
  if (t.status === 'Closed') return []
  const mine = role.value === t.turn
  if (role.value === 'branch') {
    if (!mine) return []
    if (t.status === 'Resolved') return [{ key: 'close', label: 'Verify & Close', solid: true }]
    if (t.response_pending === 'Pending Branch') return [{ key: 'submit_info', label: 'Submit Info', solid: true }]
    return []
  }
  if (role.value === 'cpc') {
    if (t.status === 'Resolved') return []
    if (t.turn === 'helpdesk') return [{ key: 'take', label: 'Take & Start', solid: true }]
    if (!mine) return []
    if (t.response_pending === 'Pending Branch') return []
    return [
      { key: 'resolve', label: 'Resolve', solid: true },
      { key: 'need_info', label: 'Need Branch Info' },
    ]
  }
  // helpdesk: triage unassigned + supervisor close on resolved
  if (t.status === 'Resolved') return [{ key: 'close', label: 'Close', solid: true }]
  if (t.turn === 'helpdesk') return [{ key: 'assign', label: 'Assign', solid: true }]
  return []
}

const dlg = ref<{ type: string; ticket: any } | null>(null)
const dlgOpen = ref(false)
const remark = ref('')
const assignTo = ref('')
const dlgError = ref<string | null>(null)
const acting = ref(false)

const cpcUsers = useCall<any, Record<string, any>>({
  url: `/api/v2/method/${API}.list_cpc_users`,
  immediate: false,
  initialData: [] as any,
})

function callApi(fn: string, args: any) {
  acting.value = true
  dlgError.value = null
  return useCall<any, Record<string, any>>({
    url: `/api/v2/method/${API}.${fn}`,
    method: 'POST',
    immediate: false,
  })
    .submit(args)
    .then(() => {
      dlg.value = null
      dlgOpen.value = false
      remark.value = ''
      dashboard.reload()
    })
    .catch((e: any) => {
      dlgError.value = e?.message || 'Action failed.'
    })
    .finally(() => {
      acting.value = false
    })
}

function runAction(t: any, key: string) {
  if (key === 'take') return callApi('take_and_start', { ticket: t.name })
  if (key === 'need_info') return callApi('need_branch_info', { ticket: t.name })
  if (key === 'submit_info') {
    window.open(`/app/sahayog-ticket/${t.name}`, '_blank')
    return
  }
  if (key === 'assign') {
    cpcUsers.reload()
    dlg.value = { type: 'assign', ticket: t }
    dlgOpen.value = true
    return
  }
  dlg.value = { type: key, ticket: t }
  dlgOpen.value = true
}

function confirmDialog() {
  const d = dlg.value
  if (!d) return
  if (d.type === 'assign') {
    if (!assignTo.value) {
      dlgError.value = 'Select an agent.'
      return
    }
    return callApi('assign_ticket', { ticket: d.ticket.name, user: assignTo.value })
  }
  if (d.type === 'resolve') {
    if (!remark.value) {
      dlgError.value = 'Resolution remark is required.'
      return
    }
    return callApi('mark_resolved', { ticket: d.ticket.name, remark: remark.value })
  }
  return callApi('verify_and_close', { ticket: d.ticket.name, remark: remark.value })
}

function bulkClose() {
  acting.value = true
  Promise.all(
    selection.value.map((t: any) =>
      useCall<any, Record<string, any>>({
        url: `/api/v2/method/${API}.verify_and_close`,
        method: 'POST',
        immediate: false,
      }).submit({ ticket: t.name, remark: '' }),
    ),
  ).then(() => {
    selection.value = []
    acting.value = false
    dashboard.reload()
  })
}

function goLogin() {
  window.location.href = '/login?redirect-to=/account_service'
}
</script>

<template>
  <div class="h-screen w-full bg-surface-base text-ink-gray-9">
    <div v-if="isGuest" class="flex h-full items-center justify-center">
      <div class="text-center">
        <div class="text-lg font-semibold">Please sign in</div>
        <Button class="mt-3" variant="solid" label="Login" @click="goLogin" />
      </div>
    </div>
    <DesktopShell v-else>
      <template #sidebar>
        <Sidebar width="14rem" class="border-r">
          <SidebarHeader title="Helpdesk" subtitle="Account Updation" />
          <ScrollArea class="min-h-0 flex-1" viewport-class="px-2 pt-0.5 pb-10">
            <div class="space-y-0.5">
              <SidebarItem :active="true">
                <template #prefix><span class="lucide-ticket size-4" aria-hidden="true" /></template>
                <span class="flex-1 truncate text-sm">Service Requests</span>
                <template #suffix><Badge variant="ghost" :label="String(tabs.all ?? 0)" /></template>
              </SidebarItem>
            </div>
            <div class="mt-4 flex h-7 items-center"><SidebarLabel>Views</SidebarLabel></div>
            <div class="mt-0.5 space-y-0.5">
              <SidebarItem :active="!rp" @click="resetFilters()">
                <template #prefix><span class="lucide-list size-4" aria-hidden="true" /></template>
                <span class="flex-1 truncate text-sm">All requests</span>
              </SidebarItem>
              <SidebarItem :active="rp === 'Pending Operations'" @click="pickRp('Pending Operations')">
                <template #prefix><span class="lucide-headset size-4" aria-hidden="true" /></template>
                <span class="flex-1 truncate text-sm">Pending CPC User</span>
              </SidebarItem>
              <SidebarItem :active="rp === 'Pending Branch'" @click="pickRp('Pending Branch')">
                <template #prefix><span class="lucide-building-2 size-4" aria-hidden="true" /></template>
                <span class="flex-1 truncate text-sm">Pending Branch User</span>
              </SidebarItem>
              <SidebarItem :active="rp === 'Resolved'" @click="pickRp('Resolved')">
                <template #prefix><span class="lucide-circle-check size-4" aria-hidden="true" /></template>
                <span class="flex-1 truncate text-sm">Resolved</span>
              </SidebarItem>
            </div>
            <div class="mt-4 flex h-7 items-center"><SidebarLabel>Role</SidebarLabel></div>
            <div class="px-2 text-sm text-ink-gray-5">{{ roleName[role] }} · {{ boot.user }}</div>
          </ScrollArea>
          <div class="mt-auto px-2 pb-2"><SidebarCollapseToggle /></div>
        </Sidebar>
      </template>

      <PageHeader>
        <PageHeaderTitle title="Helpdesk" />
        <Button variant="solid" label="New Service Request" icon-left="lucide-plus" @click="showCreate = true" />
      </PageHeader>

      <div class="px-3 pt-3 sm:px-5">
        <!-- search row: Request ID visible here (no header overlap) -->
        <div class="mb-2 grid grid-cols-3 gap-2">
          <TextInput variant="outline" v-model="qId" type="search" placeholder="Search Request ID…" :debounce="400">
            <template #prefix><span class="lucide-search size-4 text-ink-gray-5" aria-hidden="true" /></template>
          </TextInput>
          <TextInput variant="outline" v-model="qCustomer" type="search" placeholder="Search customer name…" :debounce="400">
            <template #prefix><span class="lucide-search size-4 text-ink-gray-5" aria-hidden="true" /></template>
          </TextInput>
          <TextInput variant="outline" v-model="qAccount" type="search" placeholder="Search account number…" :debounce="400">
            <template #prefix><span class="lucide-search size-4 text-ink-gray-5" aria-hidden="true" /></template>
          </TextInput>
        </div>

        <!-- tabs + status badges -->
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <TabButtons
            v-model="tab"
            :options="[
              { label: `All (${tabs.all ?? 0})`, value: 'all' },
              { label: `Pending (${tabs.pending ?? 0})`, value: 'pending' },
              { label: `Closed (${tabs.closed ?? 0})`, value: 'closed' },
            ]"
          />
          <span class="mx-1 h-5 w-px bg-outline-gray-1" />
          <button
            class="rounded-full border px-2.5 py-1 text-xs"
            :class="rp === 'Pending Operations' ? 'border-blue-500 bg-blue-50 font-semibold' : 'border-outline-gray-1'"
            @click="pickRp('Pending Operations')"
          >
            <span class="mr-1 inline-block size-2 rounded-full bg-surface-blue-7" />Pending CPC User {{ tabs.pending_operations ?? 0 }}
          </button>
          <button
            class="rounded-full border px-2.5 py-1 text-xs"
            :class="rp === 'Pending Branch' ? 'border-amber-500 bg-amber-50 font-semibold' : 'border-outline-gray-1'"
            @click="pickRp('Pending Branch')"
          >
            <span class="mr-1 inline-block size-2 rounded-full bg-surface-amber-7" />Pending Branch User {{ tabs.pending_branch ?? 0 }}
          </button>
          <button
            class="rounded-full border px-2.5 py-1 text-xs"
            :class="rp === 'Resolved' ? 'border-green-500 bg-green-50 font-semibold' : 'border-outline-gray-1'"
            @click="pickRp('Resolved')"
          >
            <span class="mr-1 inline-block size-2 rounded-full bg-surface-green-7" />Resolved {{ tabs.resolved_rp ?? 0 }}
          </button>
          <span v-if="selection.length" class="ml-auto flex items-center gap-2 text-sm text-ink-gray-5">
            {{ selection.length }} selected
            <Button size="sm" label="Close selected" icon-left="lucide-check" :loading="acting" @click="bulkClose" />
          </span>
        </div>

        <!-- dense data table (fits width, no scroll bar) -->
        <div class="rounded-6 border border-outline-gray-1 bg-surface-white">
          <List
            class="w-full list-row-px-2"
            :columns="['2.5rem', '8.5rem', '11rem', 'minmax(0,1fr)', '6.5rem', '4.5rem', '7rem', '6.5rem', '6.5rem', '7.5rem']"
            :row-height="52"
            selectable
            v-model:selection="selection"
          >
            <ListHeader>
              <ListHeaderCell><span /></ListHeaderCell>
              <ListHeaderCell>Request ID</ListHeaderCell>
              <ListHeaderCell>Request Type</ListHeaderCell>
              <ListHeaderCell>Customer</ListHeaderCell>
              <ListHeaderCell>Status</ListHeaderCell>
              <ListHeaderCell>Priority</ListHeaderCell>
              <ListHeaderCell>Assigned To</ListHeaderCell>
              <ListHeaderCell>Turn With</ListHeaderCell>
              <ListHeaderCell>Date</ListHeaderCell>
              <ListHeaderCell>Action</ListHeaderCell>
            </ListHeader>
            <ListRows :items="rows" v-slot="{ item: t, value }">
              <ListRow :value="value">
                <ListCell><span /></ListCell>
                <ListCell>
                  <a
                    class="truncate font-mono text-[13px] text-ink-blue-5 hover:underline"
                    :title="t.name"
                    :href="`/app/sahayog-ticket/${t.name}`"
                    target="_blank"
                  >
                    {{ t.name }}
                  </a>
                </ListCell>
                <ListCell><span class="truncate text-[13px] text-ink-gray-7" :title="t.request_type || ''">{{ t.request_type || '—' }}</span></ListCell>
                <ListCell>
                  <div class="min-w-0">
                    <div class="truncate text-[13px] text-ink-gray-8">{{ t.customerLine || '—' }}</div>
                    <div class="truncate font-mono text-xs text-ink-gray-5">{{ t.account_number || '' }}</div>
                  </div>
                </ListCell>
                <ListCell>
                  <span
                    class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-outline-gray-1 px-2 py-0.5 text-xs"
                  >
                    <span class="size-2 rounded-full" :class="statusDot[t.status]" aria-hidden="true" />
                    {{ t.status }}
                  </span>
                </ListCell>
                <ListCell><span class="text-[13px]">{{ t.priority || '—' }}</span></ListCell>
                <ListCell>
                  <div class="flex items-center">
                    <Avatar :label="t.assigned_to_name || t.assigned_to || '–'" size="sm" />
                    <span class="ml-1.5 truncate text-[13px] text-ink-gray-7">{{ t.assigned_to_name || '—' }}</span>
                  </div>
                </ListCell>
                <ListCell>
                  <div>
                    <Badge :theme="pendingFrom(t)!.theme" :label="pendingFrom(t)!.label" />
                    <div v-if="t.lastAction" class="mt-0.5 truncate text-[11px] text-ink-gray-5" :title="`Last action by ${t.last_action_by}`">
                      {{ t.lastAction }}
                    </div>
                  </div>
                </ListCell>
                <ListCell>
                  <span
                    class="text-[13px]"
                    :class="t.breached ? 'font-semibold text-ink-red-5' : 'text-ink-gray-7'"
                    :title="`Due: ${t.slaDue}`"
                  >
                    {{ fmtDate(t.creation) }}
                  </span>
                </ListCell>
                <ListCell>
                  <div class="flex flex-col gap-1">
                    <Button
                      v-for="a in actionsFor(t)"
                      :key="a.key"
                      size="sm"
                      :variant="a.solid ? 'solid' : 'subtle'"
                      :label="a.label"
                      @click="runAction(t, a.key)"
                    />
                  </div>
                </ListCell>
              </ListRow>
            </ListRows>
          </List>
          <div class="flex items-center justify-between border-t border-outline-gray-1 px-3 py-2 text-xs text-ink-gray-5">
            <span>Showing {{ rows.length }} of {{ total }} requests</span>
            <span v-if="dashboard.loading">Loading…</span>
          </div>
        </div>
        <ErrorMessage v-if="dashboard.error" :message="dashboard.error.message" class="mt-2" />
      </div>

      <CreateServiceDialog
        :departments="options.departments || []"
        :service-types="options.service_types || []"
        :agents="options.agents || []"
        v-model:open="showCreate"
        @created="dashboard.reload()"
      />

      <Dialog v-model="dlgOpen" :title="dlg?.type === 'assign' ? 'Assign Ticket' : dlg?.type === 'resolve' ? 'Mark Resolved' : 'Verify & Close'">
        <ErrorMessage v-if="dlgError" :message="dlgError" class="mb-3" />
        <Select
          v-if="dlg?.type === 'assign'"
          v-model="assignTo"
          label="Assigned Agent"
          :options="(cpcUsers.data || []).map((u: any) => ({ label: `${u.name} (${u.email})`, value: u.email }))"
        />
        <Textarea
          v-else
          v-model="remark"
          :label="dlg?.type === 'resolve' ? 'Resolution remark (required)' : 'Closing remark'"
        />
        <template #actions>
          <Button variant="solid" label="Confirm" :loading="acting" @click="confirmDialog" />
        </template>
      </Dialog>
    </DesktopShell>
  </div>
</template>
