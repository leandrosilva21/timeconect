/**
 * Minutor Design System — re-exports canônicos.
 *
 * Importe tudo daqui pra forçar o uso dos componentes oficiais:
 *
 *   import {
 *     DataTable, DataTableHead, DataTableHeadCell, DataTableBody, DataTableRow, DataTableCell, DataTableEmpty,
 *     Modal, ModalHeader, ModalBody, ModalFooter,
 *     StatusBadge, getStatusVariant,
 *     KpiCard,
 *   } from '@/components/ui/ds'
 *
 * Outros utilitários do DS já existem como classes CSS em globals.css:
 *   - .ds-btn-primary / .ds-btn-secondary / .ds-btn-ghost / .ds-btn-danger
 *   - .ds-input
 *   - .ds-card / .ds-card-header / .ds-card-title / .ds-card-sub
 *   - .ds-row-hover, .ds-tab-active / .ds-tab-inactive
 *   - .sidebar-item / .sidebar-item-active
 *
 * Tokens disponíveis (var(--*)):
 *   - Background: --bg, --surface, --surface-hover, --surface-sunken
 *   - Texto: --text, --text-muted, --text-light
 *   - Borda: --border, --border-strong
 *   - Primary: --primary, --primary-hover, --primary-soft, --primary-fg
 *   - Semântico: --success / --warning / --danger / --info (+ -bg / -border)
 *   - Sombras: --shadow-xs / -sm / -md / -lg / -overlay
 *   - Focus: --ring
 */

export {
  DataTable,
  DataTableHead,
  DataTableHeadRow,
  DataTableHeadCell,
  DataTableBody,
  DataTableRow,
  DataTableCell,
  DataTableEmpty,
} from './data-table'

export {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from './modal'

export {
  StatusBadge,
  StatusRecommendation,
  StatusActions,
  getStatusVariant,
  getStatusMeta,
  isActionAllowed,
  sortByStatusPriority,
  STATUS_META,
  type StatusVariant,
  type StatusMeta,
} from './status-badge'

export { KpiCard, type KpiAccent } from './kpi-card'
