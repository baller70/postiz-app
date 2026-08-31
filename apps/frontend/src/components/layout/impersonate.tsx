import { Input } from '@gitroom/react/form/input';
import {
  ChangeEventHandler,
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Select } from '@gitroom/react/form/select';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { setCookie } from '@gitroom/frontend/components/layout/layout.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { Button } from '@gitroom/react/form/button';
import { ImportDebugPostModal } from '@gitroom/frontend/components/launches/import-debug-post.modal';
import { MenuItem } from '@gitroom/frontend/components/new-layout/menu-item';
import {
  FiAlertTriangle,
  FiBarChart2,
  FiBell,
  FiChevronRight,
  FiSearch,
  FiShield,
  FiUpload,
  FiUserCheck,
  FiX,
} from '@meronex/icons/fi';

interface Charge {
  id: string;
  amount: number;
  currency: string;
  created: number;
  status: string;
  refunded: boolean;
  amount_refunded: number;
  description: string | null;
  receipt_url: string | null;
  invoice_pdf: string | null;
}

const useCharges = () => {
  const fetch = useFetch();
  return useSWR<Charge[]>(
    '/billing/charges',
    async () => {
      return (await fetch('/billing/charges')).json();
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
    }
  );
};

const ChargesModal: FC<{ close: () => void }> = ({ close }) => {
  const fetch = useFetch();
  const t = useT();
  const { data: charges, mutate } = useCharges();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [refunding, setRefunding] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const toggleCharge = useCallback((chargeId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(chargeId)) {
        next.delete(chargeId);
      } else {
        next.add(chargeId);
      }
      return next;
    });
  }, []);

  const handleRefund = useCallback(async () => {
    if (!selected.size) return;
    if (
      !(await deleteDialog(
        t(
          'refund_selected_confirm',
          `Are you sure you want to refund ${selected.size} charge(s)? This cannot be undone.`
        ),
        t('yes_refund', 'Yes, refund'),
        t('confirm_refund', 'Confirm Refund'),
        t('no_cancel', 'No, cancel')
      ))
    ) {
      return;
    }
    setRefunding(true);
    try {
      await fetch('/billing/refund-charges', {
        method: 'POST',
        body: JSON.stringify({ chargeIds: Array.from(selected) }),
      });
      setSelected(new Set());
      await mutate();
    } finally {
      setRefunding(false);
    }
  }, [selected]);

  const handleCancel = useCallback(async () => {
    if (
      !(await deleteDialog(
        t(
          'cancel_subscription_confirm',
          'This will immediately cancel the subscription. The user will be downgraded to the FREE plan. This cannot be undone.'
        ),
        t('yes_cancel_subscription', 'Yes, cancel subscription'),
        t('cancel_subscription_title', 'Cancel Subscription?'),
        t('no_go_back', 'No, go back')
      ))
    ) {
      return;
    }
    setCancelling(true);
    try {
      await fetch('/billing/cancel-subscription', {
        method: 'POST',
      });
      close();
      window.location.reload();
    } catch {
      setCancelling(false);
    }
  }, []);

  return (
    <div className="flex flex-col gap-[16px] min-w-[500px]">
      <div className="max-h-[400px] overflow-y-auto">
        {!charges?.length ? (
          <div className="text-center py-[20px] text-newTextColor/60">
            {t('no_charges', 'No charges found')}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-newTableBorder">
                <th className="p-[8px] w-[40px]" />
                <th className="p-[8px]">{t('date', 'Date')}</th>
                <th className="p-[8px]">{t('amount', 'Amount')}</th>
                <th className="p-[8px]">{t('status', 'Status')}</th>
                <th className="p-[8px] w-[50px]" />
              </tr>
            </thead>
            <tbody>
              {charges.map((charge) => (
                <tr
                  key={charge.id}
                  className="border-b border-newTableBorder hover:bg-tableBorder cursor-pointer"
                  onClick={() => !charge.refunded && toggleCharge(charge.id)}
                >
                  <td className="p-[8px]">
                    <div
                      className={`w-[20px] h-[20px] rounded-[4px] border-2 flex items-center justify-center ${
                        charge.refunded
                          ? 'border-newTextColor/20 opacity-40'
                          : selected.has(charge.id)
                          ? 'bg-forth border-forth'
                          : 'border-newTextColor/40'
                      }`}
                    >
                      {(selected.has(charge.id) || charge.refunded) && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </td>
                  <td className="p-[8px]">
                    {new Date(charge.created * 1000).toLocaleDateString()}
                  </td>
                  <td className="p-[8px]">
                    ${(charge.amount / 100).toFixed(2)}{' '}
                    {charge.currency.toUpperCase()}
                  </td>
                  <td className="p-[8px]">
                    {charge.refunded ? (
                      <span className="text-red-400">
                        {t('refunded', 'Refunded')}
                      </span>
                    ) : (
                      <span className="text-green-400">
                        {t('paid', 'Paid')}
                      </span>
                    )}
                  </td>
                  <td className="p-[8px]">
                    {(charge.invoice_pdf || charge.receipt_url) && (
                      <a
                        href={charge.invoice_pdf || charge.receipt_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center w-[28px] h-[28px] rounded-[4px] hover:bg-tableBorder transition-colors"
                        title={
                          charge.invoice_pdf
                            ? t('download_invoice', 'Download Invoice')
                            : t('view_receipt', 'View Receipt')
                        }
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex gap-[12px] justify-end">
        <Button
          onClick={handleRefund}
          loading={refunding}
          disabled={!selected.size}
          className="rounded-[4px]"
        >
          {t('refund_selected', 'Refund Selected')}
          {selected.size > 0 && ` (${selected.size})`}
        </Button>
        <Button
          onClick={handleCancel}
          loading={cancelling}
          className="!bg-red-700 rounded-[4px]"
        >
          {t('cancel_subscription', 'Cancel Subscription')}
        </Button>
      </div>
    </div>
  );
};

const ManageBilling = ({ onAction }: { onAction?: () => void }) => {
  const { openModal } = useModals();
  const t = useT();

  const handleClick = useCallback(() => {
    onAction?.();
    openModal({
      title: t('manage_billing', 'Manage Billing'),
      children: (close) => <ChargesModal close={close} />,
    });
  }, [onAction, openModal, t]);

  return (
    <button
      type="button"
      className="h-[38px] rounded-[6px] border border-newTableBorder px-[12px] text-[12px] font-[600] text-newTextColor hover:bg-boxHover"
      onClick={handleClick}
    >
      {t('manage_billing', 'Manage Billing')}
    </button>
  );
};

export const Subscription = () => {
  const fetch = useFetch();
  const t = useT();

  const addSubscription: ChangeEventHandler<HTMLSelectElement> = useCallback(
    async (e) => {
      const value = e.target.value;
      if (
        await deleteDialog(
          'Are you sure you want to add a user subscription?',
          'Add'
        )
      ) {
        await fetch('/billing/add-subscription', {
          method: 'POST',
          body: JSON.stringify({
            subscription: value,
          }),
        });
        window.location.reload();
      }
    },
    []
  );
  return (
    <Select
      onChange={addSubscription}
      hideErrors={true}
      disableForm={true}
      name="sub"
      label=""
      value=""
    >
      <option>
        {t('add_free_subscription', '-- ADD FREE SUBSCRIPTION --')}
      </option>
      {Object.keys(pricing)
        .filter((f) => !f.includes('FREE'))
        .map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
    </Select>
  );
};
const colorOptions = [
  { value: 'INFO', label: 'Info (Blue)', className: 'bg-blue-600' },
  { value: 'WARNING', label: 'Warning (Amber)', className: 'bg-amber-600' },
  { value: 'ERROR', label: 'Error (Red)', className: 'bg-red-600' },
];

const AddAnnouncementModal: FC<{ close: () => void }> = ({ close }) => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();
  const t = useT();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('INFO');
  const [saving, setSaving] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !description.trim()) return;
    setSaving(true);
    try {
      await fetch('/announcements', {
        method: 'POST',
        body: JSON.stringify({ title, description, color }),
      });
      await mutate('/announcements');
      close();
    } finally {
      setSaving(false);
    }
  }, [title, description, color]);

  return (
    <div className="flex flex-col gap-[16px] min-w-[500px]">
      <Input
        label={t('announcement_title', 'Title')}
        name="title"
        disableForm={true}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('announcement_title_placeholder', 'Announcement title')}
      />
      <div className="flex flex-col gap-[6px]">
        <label className="text-[14px]">
          {t('announcement_description', 'Description')}
        </label>
        <textarea
          className="bg-input border border-tableBorder rounded-[8px] p-[10px] text-newTextColor min-h-[120px] outline-none resize-y"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t(
            'announcement_description_placeholder',
            'Announcement description'
          )}
        />
      </div>
      <div className="flex flex-col gap-[6px]">
        <label className="text-[14px]">
          {t('announcement_color', 'Color')}
        </label>
        <div className="flex gap-[8px]">
          {colorOptions.map((opt) => (
            <div
              key={opt.value}
              onClick={() => setColor(opt.value)}
              className={`flex-1 text-center py-[8px] rounded-[8px] text-white text-[13px] cursor-pointer transition-opacity ${
                opt.className
              } ${
                color === opt.value
                  ? 'opacity-100 ring-2 ring-white'
                  : 'opacity-40'
              }`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          loading={saving}
          disabled={!title.trim() || !description.trim()}
          className="rounded-[4px]"
        >
          {t('create_announcement', 'Create Announcement')}
        </Button>
      </div>
    </div>
  );
};

const AdminAction = ({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex min-h-[44px] w-full items-center gap-[10px] rounded-[6px] border border-newTableBorder px-[11px] text-start text-[12px] font-[600] text-newTextColor hover:bg-boxHover"
  >
    <span className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[6px] bg-boxHover text-textItemBlur">
      {icon}
    </span>
    <span className="min-w-0 flex-1 truncate">{label}</span>
    <FiChevronRight
      size={14}
      className="shrink-0 text-textItemBlur"
      aria-hidden="true"
    />
  </button>
);

const AddAnnouncement = ({ onAction }: { onAction: () => void }) => {
  const { openModal } = useModals();
  const t = useT();

  const handleClick = useCallback(() => {
    onAction();
    openModal({
      title: t('add_announcement', 'Add Announcement'),
      children: (close) => <AddAnnouncementModal close={close} />,
    });
  }, [onAction, openModal, t]);

  return (
    <AdminAction
      icon={<FiBell size={16} aria-hidden="true" />}
      label={t('add_announcement', 'Add Announcement')}
      onClick={handleClick}
    />
  );
};

const ViewErrors = ({ onAction }: { onAction: () => void }) => {
  const t = useT();
  const handleClick = useCallback(() => {
    onAction();
    window.location.href = '/admin/errors';
  }, [onAction]);
  return (
    <AdminAction
      icon={<FiAlertTriangle size={16} aria-hidden="true" />}
      label={t('view_errors', 'View Errors')}
      onClick={handleClick}
    />
  );
};

const ViewStats = ({ onAction }: { onAction: () => void }) => {
  const t = useT();
  const handleClick = useCallback(() => {
    onAction();
    window.location.href = '/admin/stats';
  }, [onAction]);
  return (
    <AdminAction
      icon={<FiBarChart2 size={16} aria-hidden="true" />}
      label={t('view_stats', 'View Stats')}
      onClick={handleClick}
    />
  );
};

const ImportDebugPost = ({ onAction }: { onAction: () => void }) => {
  const { openModal } = useModals();
  const t = useT();

  const handleClick = useCallback(() => {
    onAction();
    openModal({
      title: t('import_debug_post', 'Import Debug Post'),
      maxSize: 800,
      children: (close) => <ImportDebugPostModal close={close} />,
    });
  }, [onAction, openModal, t]);

  return (
    <AdminAction
      icon={<FiUpload size={16} aria-hidden="true" />}
      label={t('import_debug_post', 'Import Debug Post')}
      onClick={handleClick}
    />
  );
};

export const Impersonate = () => {
  const fetch = useFetch();
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const { isSecured, billingEnabled } = useVariables();
  const user = useUser();
  const load = useCallback(async () => {
    if (!name) {
      return [];
    }
    const value = await (await fetch(`/user/impersonate?name=${name}`)).json();
    return value;
  }, [name]);
  const stopImpersonating = useCallback(async () => {
    if (!isSecured) {
      setCookie('impersonate', '', -10);
    } else {
      await fetch(`/user/impersonate`, {
        method: 'POST',
        body: JSON.stringify({
          id: '',
        }),
      });
    }
    window.location.reload();
  }, []);
  const t = useT();
  const closePanel = useCallback(() => {
    setOpen(false);
    setName('');
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePanel();
      }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [closePanel, open]);

  const setUser = useCallback(
    (userId: string) => async () => {
      await fetch(`/user/impersonate`, {
        method: 'POST',
        body: JSON.stringify({
          id: userId,
        }),
      });
      window.location.reload();
    },
    []
  );
  const { data } = useSWR(`/impersonate-${name}`, load, {
    refreshWhenHidden: false,
    revalidateOnMount: true,
    revalidateOnReconnect: false,
    revalidateOnFocus: false,
    refreshWhenOffline: false,
    revalidateIfStale: false,
    refreshInterval: 0,
  });
  const mapData = useMemo(() => {
    return data?.map(
      (curr: any) => ({
        id: curr.id,
        name: curr.user.name,
        email: curr.user.email,
      }),
      []
    );
  }, [data]);
  return (
    <>
      <MenuItem
        label={t('admin_tools', 'Admin')}
        icon={<FiShield size={20} aria-hidden="true" />}
        path="#"
        onClick={() => setOpen((current) => !current)}
      />

      {open ? (
        <>
          <button
            type="button"
            aria-label={t('close_admin_tools', 'Close admin tools')}
            className="fixed inset-0 z-[997] cursor-default bg-black/20"
            onClick={closePanel}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-tools-title"
            className="fixed bottom-[12px] start-[92px] z-[998] flex max-h-[calc(100vh-24px)] w-[min(360px,calc(100vw-104px))] flex-col overflow-y-auto rounded-[8px] border border-newTableBorder bg-newBgColorInner p-[14px] text-newTextColor shadow-2xl"
          >
            <header className="flex items-center justify-between gap-[12px] border-b border-newTableBorder pb-[12px]">
              <div className="flex min-w-0 items-center gap-[9px]">
                <span className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[6px] bg-boxHover text-textItemBlur">
                  <FiShield size={17} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2
                    id="admin-tools-title"
                    className="truncate text-[14px] font-[700]"
                  >
                    {t('admin_tools', 'Admin tools')}
                  </h2>
                  <p className="truncate text-[10px] text-textItemBlur">
                    {user?.impersonate
                      ? t('impersonation_active', 'Impersonation active')
                      : t('admin_shortcuts', 'User and support shortcuts')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closePanel}
                aria-label={t('close_admin_tools', 'Close admin tools')}
                className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[6px] text-textItemBlur hover:bg-boxHover hover:text-newTextColor"
              >
                <FiX size={18} aria-hidden="true" />
              </button>
            </header>

            {user?.impersonate ? (
              <div className="flex flex-col gap-[12px] pt-[12px]">
                <div className="flex items-center gap-[9px] rounded-[6px] border border-amber-500/30 bg-amber-500/10 p-[10px] text-[12px] font-[600] text-amber-700 dark:text-amber-300">
                  <FiUserCheck size={17} aria-hidden="true" />
                  {t('currently_impersonating', 'Currently impersonating')}
                </div>
                <button
                  type="button"
                  className="flex h-[40px] items-center justify-center gap-[7px] rounded-[6px] bg-red-600 px-[12px] text-[12px] font-[600] text-white hover:bg-red-700"
                  onClick={stopImpersonating}
                >
                  <FiX size={15} aria-hidden="true" />
                  {t('stop_impersonating', 'Stop impersonating')}
                </button>
                {user?.tier?.current === 'FREE' ? <Subscription /> : null}
                {billingEnabled ? (
                  <ManageBilling onAction={closePanel} />
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-[12px] pt-[12px]">
                <div className="relative">
                  <FiSearch
                    size={16}
                    className="pointer-events-none absolute start-[11px] top-[13px] z-[1] text-textItemBlur"
                    aria-hidden="true"
                  />
                  <div className="[&_input]:ps-[34px]">
                    <Input
                      autoComplete="off"
                      placeholder={t(
                        'search_users',
                        'Search users by name or email'
                      )}
                      name="impersonate"
                      disableForm={true}
                      label=""
                      removeError={true}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>

                {name.trim() && data ? (
                  <div className="max-h-[220px] overflow-y-auto rounded-[6px] border border-newTableBorder">
                    {mapData?.length ? (
                      mapData.map((user: any) => (
                        <button
                          type="button"
                          onClick={setUser(user.id)}
                          key={user.id}
                          className="flex w-full flex-col border-b border-newTableBorder px-[10px] py-[9px] text-start last:border-b-0 hover:bg-boxHover"
                        >
                          <span className="truncate text-[12px] font-[600]">
                            {user.name || t('unnamed_user', 'Unnamed user')}
                          </span>
                          <span className="truncate text-[10px] text-textItemBlur">
                            {user.email} · {user.id.split('-').at(-1)}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-[10px] py-[14px] text-center text-[11px] text-textItemBlur">
                        {t('no_users_found', 'No users found')}
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-[7px] sm:grid-cols-2">
                  <ImportDebugPost onAction={closePanel} />
                  <AddAnnouncement onAction={closePanel} />
                  <ViewErrors onAction={closePanel} />
                  <ViewStats onAction={closePanel} />
                </div>
              </div>
            )}
          </section>
        </>
      ) : null}
    </>
  );
};
