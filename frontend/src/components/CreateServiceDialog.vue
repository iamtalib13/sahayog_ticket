<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Button,
  Dialog,
  ErrorMessage,
  FileUploader,
  Select,
  Textarea,
  TextInput,
  type UploadedFile,
} from 'frappe-ui'
import {
  Editor,
  EditorContent,
  EditorFixedMenu,
  CommentKit,
  commentToolbar,
} from 'frappe-ui/editor'
import { useCall } from 'frappe-ui'

const API = 'sahayog_ticket.sahayog_ticket.page.account_service.account_service_api'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits(['created'])

const props = defineProps<{
  departments: string[]
  serviceTypes: string[]
  agents: { email: string; name: string }[]
}>()

const FIELD_LABELS: Record<string, string> = {
  new_address: 'New Address',
  new_contact_number: 'New Contact Number',
  new_email: 'New Email',
  new_kyc_no: 'New KYC No',
  new_pan_no: 'New PAN No',
  new_name: 'Enter New Name',
  nomination_opration: 'Nomination Operation',
  existing_branch: 'Existing Branch',
  new_branch: 'New Branch',
  updated_dob: 'Updated DOB',
}
// Proper account-updation fields, always visible with helper text.
// Only the ones needed for the chosen Request Type are required.
const ALL_UPDATE_FIELDS: { key: string; label: string; desc: string; type: string; options?: string[] }[] = [
  { key: 'new_address', label: 'New Address', desc: 'Full new address for Change of Address', type: 'textarea' },
  { key: 'new_contact_number', label: 'New Contact Number', desc: '10-digit mobile for Contact Update / SMS Alert', type: 'text' },
  { key: 'new_email', label: 'New Email', desc: 'New email for Email Update', type: 'text' },
  { key: 'new_kyc_no', label: 'New KYC No', desc: 'Aadhaar / Voter / Passport number', type: 'text' },
  { key: 'new_pan_no', label: 'New PAN No', desc: 'Format ABCDE1234F', type: 'text' },
  { key: 'new_name', label: 'Enter New Name', desc: 'Corrected name for Name Change', type: 'text' },
  { key: 'nomination_opration', label: 'Nomination Operation', desc: 'Addition / Deletion / Modification', type: 'select', options: ['Addition', 'Deletion', 'Modification'] },
  { key: 'existing_branch', label: 'Existing Branch', desc: 'Current branch for Account Transfer', type: 'text' },
  { key: 'new_branch', label: 'New Branch', desc: 'Target branch for Account Transfer', type: 'text' },
  { key: 'updated_dob', label: 'Updated DOB', desc: 'Corrected date of birth', type: 'date' },
]
const REQ_MAP: Record<string, string[]> = {
  'Change of Address': ['new_address'],
  'Update Contact Number': ['new_contact_number'],
  'Update Email Address': ['new_email'],
  'Update KYC (Adhaar/Voter/Passport/etc)': ['new_kyc_no'],
  'Update PAN NO': ['new_pan_no'],
  'Name Change': ['new_name'],
  'SMS Alert Registration': ['new_contact_number'],
  'Nomination Addition/ Deletion/ Modification': ['nomination_opration'],
  'Account Transfer': ['existing_branch', 'new_branch'],
  'DOB Updation': ['updated_dob'],
}
const PRIORITY_MAP: Record<string, string> = { High: 'High', Medium: 'Medium', Low: 'Normal' }

const today = new Date().toISOString().slice(0, 10)
const form = ref<Record<string, any>>({
  department: 'Operations',
  request_type: props.serviceTypes[0] || '',
  status: 'Open',
  priority: 'Medium',
  assigned_to: '',
  start_date: today,
  target_sla_date: '',
})
const remarks = ref('')
const uploads = ref<UploadedFile[]>([])
const error = ref<string | null>(null)
const submitting = ref(false)

const visibleFields = computed(() => REQ_MAP[form.value.request_type] || [])

// Options load async — default request type once available
watch(
  () => props.serviceTypes,
  (types) => {
    if (types?.length && !form.value.request_type) form.value.request_type = types[0]
  },
  { immediate: true },
)

const finacle = useCall<any, Record<string, any>>({
  url: '/api/v2/method/sahayog_ticket.sahayog_ticket.doctype.sahayog_ticket.account_api.get_account_details',
  method: 'POST',
  immediate: false,
})
const creator = useCall<any, Record<string, any>>({
  url: `/api/v2/method/${API}.create_account_request`,
  method: 'POST',
  immediate: false,
})

async function lookup() {
  error.value = null
  if (!form.value.account_number) {
    error.value = 'Pehle Customer Account No dalo.'
    return
  }
  try {
    const v: any = await finacle.submit({ account_number: form.value.account_number })
    form.value.cif = v?.cif || v?.customer_id || ''
    form.value.customer_name = v?.customer_name || v?.acct_name || ''
    form.value.account_type = v?.account_type || v?.schm_type || ''
    form.value.email = v?.email || ''
    form.value.contact_number = v?.contact_number || v?.phone_no || v?.phoneno || ''
  } catch (e: any) {
    error.value = e?.message || 'Lookup failed.'
  }
}

function onUpload(f: UploadedFile) {
  uploads.value.push(f)
}

async function submit() {
  error.value = null
  if (!form.value.request_type) {
    error.value = 'Request Type select karo.'
    return
  }
  if (!/^\d{15}$/.test(String(form.value.account_number || ''))) {
    error.value = 'Account Number must be exactly 15 digits.'
    return
  }
  for (const f of visibleFields.value) {
    if (!form.value[f]) {
      error.value = `${FIELD_LABELS[f]} is required for ${form.value.request_type}.`
      return
    }
  }
  submitting.value = true
  try {
    const res: any = await creator.submit({
      args: {
        ...form.value,
        priority: PRIORITY_MAP[form.value.priority] || 'Normal',
        remarks: remarks.value,
        attach_urls: uploads.value.map((u) => u.file_url),
      },
    })
    emit('created', res?.name)
    close()
  } catch (e: any) {
    error.value = e?.message || 'Submit failed.'
  } finally {
    submitting.value = false
  }
}

function close() {
  form.value = {
    department: 'Operations',
    request_type: props.serviceTypes[0] || '',
    status: 'Open',
    priority: 'Medium',
    assigned_to: '',
    start_date: today,
    target_sla_date: '',
  }
  remarks.value = ''
  uploads.value = []
  error.value = null
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open" title="Raise Service Request" size="xl">
    <p class="mb-4 text-sm text-ink-gray-5">Initiate account detail update or support ticket</p>
    <ErrorMessage v-if="error" :message="error" class="mb-3" />
    <div class="grid grid-cols-2 gap-4">
      <!-- Left column -->
      <div class="space-y-3">
        <div class="flex items-end gap-2">
          <TextInput
            variant="outline"
            v-model="form.account_number"
            label="Customer Account No / ID"
            placeholder="15-digit account no"
            required
            class="flex-1"
          />
          <Button label="Lookup" :loading="finacle.loading" @click="lookup" />
        </div>
        <TextInput variant="outline" v-model="form.customer_name" label="Customer Name" placeholder="Auto-filled on lookup" />
        <div>
          <div class="mb-1 text-sm text-ink-gray-7">Request Remarks / Description</div>
          <div class="rounded-6 border border-outline-gray-1">
            <Editor v-model="remarks" :extensions="[CommentKit]" placeholder="Describe the change needed…">
              <EditorFixedMenu :items="commentToolbar" />
              <EditorContent class="min-h-28" />
            </Editor>
          </div>
        </div>
      </div>
      <!-- Right column -->
      <div class="space-y-3">
        <Select variant="outline"
          v-model="form.department"
          label="Department"
          :options="departments.map((d) => ({ label: d, value: d }))"
        />
        <Select variant="outline"
          v-model="form.request_type"
          label="Request Type"
          :options="serviceTypes.map((t) => ({ label: t, value: t }))"
        />
        <div class="grid grid-cols-2 gap-3">
          <Select variant="outline" v-model="form.status" label="Status" :options="[{ label: 'Open', value: 'Open' }]" disabled />
          <Select variant="outline"
            v-model="form.priority"
            label="Priority"
            :options="['High', 'Medium', 'Low'].map((p) => ({ label: p, value: p }))"
          />
        </div>
        <Select variant="outline"
          v-model="form.assigned_to"
          label="Assigned Agent / Guided By"
          :options="[{ label: 'Unassigned', value: '' }, ...agents.map((a) => ({ label: `${a.name} (${a.email})`, value: a.email }))]"
        />
        <div class="grid grid-cols-2 gap-3">
          <TextInput variant="outline" v-model="form.start_date" label="Start Date" type="date" />
          <TextInput variant="outline" v-model="form.target_sla_date" label="Target SLA Date" type="date" />
        </div>
        <div>
          <div class="mb-1 text-sm text-ink-gray-7">Attachments</div>
          <div
            v-for="f in uploads"
            :key="f.file_url"
            class="mb-1 flex items-center gap-2 rounded-6 border border-outline-gray-1 px-3 py-1.5 text-sm text-ink-gray-7"
          >
            <span class="lucide-paperclip size-4 text-ink-gray-5" aria-hidden="true" />
            <span class="truncate">{{ f.file_name }}</span>
          </div>
          <FileUploader @success="onUpload">
            <template #default="{ uploading, progress, error: upErr, openFileSelector }">
              <Button
                variant="ghost"
                icon-left="lucide-plus"
                :loading="uploading"
                :loading-text="`Uploading ${progress}%`"
                label="Attach file"
                @click="openFileSelector"
              />
              <ErrorMessage v-if="upErr" :message="upErr" class="mt-1" />
            </template>
          </FileUploader>
        </div>
      </div>
    </div>
    <div class="mt-4 rounded-6 border border-outline-gray-1 p-3">
      <div class="text-base-medium text-ink-gray-8">New / Updated Details</div>
      <p class="mb-2 text-xs text-ink-gray-5">
        Ye fields <b>{{ form.request_type }}</b> ke hisaab se hai — sab bharna zaroori hai.
      </p>
      <div class="grid grid-cols-2 gap-3">
        <template v-for="fld in ALL_UPDATE_FIELDS" :key="fld.key">
          <template v-if="visibleFields.includes(fld.key)">
          <Textarea
            v-if="fld.type === 'textarea'"
            variant="outline"
            v-model="form[fld.key]"
            :label="FIELD_LABELS[fld.key]"
            :description="fld.desc"
            required
          />
          <Select
            v-else-if="fld.type === 'select'"
            variant="outline"
            v-model="form[fld.key]"
            :label="FIELD_LABELS[fld.key]"
            :description="fld.desc"
            :options="[{ label: 'Select…', value: '' }, ...(fld.options || []).map((o) => ({ label: o, value: o }))]"
            required
          />
          <TextInput
            v-else
            variant="outline"
            v-model="form[fld.key]"
            :label="FIELD_LABELS[fld.key]"
            :description="fld.desc"
            :type="fld.type === 'date' ? 'date' : 'text'"
            required
          />
          </template>
        </template>
      </div>
    </div>
    <template #actions>
      <Button label="Cancel" @click="close" />
      <Button variant="solid" label="Submit Request" :loading="submitting" @click="submit" />
    </template>
  </Dialog>
</template>
