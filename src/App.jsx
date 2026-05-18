import { useState, useEffect, useCallback, useMemo } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────
const MEMBER_NAMES = ['nabrees', 'himas', 'aroos', 'anoos', 'asloof', 'haseef', 'munshif', 'rila', 'riham']
const ADMIN_PIN = '@#Hima1@#'
const ADMIN_NAME = 'himas'

const GRADIENTS = [
  'from-violet-500 to-purple-700',
  'from-blue-500 to-indigo-700',
  'from-emerald-500 to-teal-700',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-700',
  'from-cyan-500 to-blue-700',
  'from-fuchsia-500 to-violet-700',
  'from-lime-500 to-green-700',
  'from-red-500 to-orange-700',
]

// ─── Storage ──────────────────────────────────────────────────────────────────
const KEY = 'room_tracker_v4'
const defaultData = () => ({ transactions: [], deductCount: 0 })
const load = () => { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : defaultData() } catch { return defaultData() } }
const persist = (d) => localStorage.setItem(KEY, JSON.stringify(d))

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => `Rs.${Math.abs(n).toLocaleString('en-LK')}`
const nowStr = () => new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const todayPrefix = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const isToday = (d) => d?.startsWith(todayPrefix())
const todayFull = () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

// Derive members + balances from transactions
const computeMembers = (txs) =>
  MEMBER_NAMES.map((name, i) => {
    const id = i + 1
    const bal = txs.filter(t => t.memberId === id).reduce((s, t) => t.type === 'deposit' ? s + t.amount : s - t.amount, 0)
    return { id, name, balance: bal }
  })

// ─── EditableRow ──────────────────────────────────────────────────────────────
function EditableRow({ tx, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [amt, setAmt] = useState(String(tx.amount))
  const [note, setNote] = useState(tx.note)

  const handleSave = () => {
    const val = parseFloat(amt)
    if (!val || val <= 0) return
    onSave(tx.id, val, note.trim() || tx.note)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="bg-white/6 border border-violet-500/30 rounded-2xl p-3 space-y-2">
        <p className="text-violet-300 text-xs font-semibold">✏️ Edit Entry</p>
        <input
          type="number"
          min="1"
          value={amt}
          onChange={e => setAmt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/70 transition-all"
          autoFocus
        />
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="Note"
          className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/70 transition-all"
        />
        <div className="flex gap-2">
          <button onClick={handleSave} className="flex-1 bg-violet-600 hover:bg-violet-500 text-white rounded-xl py-2 text-sm font-bold transition-all">
            ✓ Update
          </button>
          <button onClick={() => setEditing(false)} className="flex-1 bg-white/8 hover:bg-white/12 text-slate-300 rounded-xl py-2 text-sm transition-all">
            Cancel
          </button>
          <button onClick={() => onDelete(tx.id)} className="bg-red-500/20 hover:bg-red-500/35 text-red-400 rounded-xl px-3 py-2 text-sm transition-all">
            🗑
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-white/3 border border-white/6 group">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 ${tx.type === 'deposit' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
        {tx.type === 'deposit' ? '💰' : '📉'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{tx.note}</p>
        <p className="text-slate-600 text-xs">{tx.date}</p>
      </div>
      <span className={`font-bold text-sm flex-shrink-0 mr-1 ${tx.type === 'deposit' ? 'text-emerald-400' : 'text-red-400'}`}>
        {tx.type === 'deposit' ? '+' : '-'}{fmt(tx.amount)}
      </span>
      <button
        onClick={() => setEditing(true)}
        className="w-7 h-7 rounded-lg bg-white/6 hover:bg-violet-500/25 text-slate-500 hover:text-violet-300 flex items-center justify-center text-xs transition-all flex-shrink-0"
      >
        ✏
      </button>
    </div>
  )
}

// ─── PersonModal ──────────────────────────────────────────────────────────────
function PersonModal({ member, allTxs, gradient, isAdmin, onClose, onAddTx, onEditTx, onDeleteTx }) {
  const [tab, setTab] = useState('cash') // 'cash' | 'expense' | 'history'
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [flash, setFlash] = useState(false)

  const memberTxs = allTxs.filter(t => t.memberId === member.id)
  const todayTxs = memberTxs.filter(t => isToday(t.date))

  const todayCash = todayTxs.filter(t => t.type === 'deposit')
  const todayExp = todayTxs.filter(t => t.type === 'deduction')
  const todayCashSum = todayCash.reduce((s, t) => s + t.amount, 0)
  const todayExpSum = todayExp.reduce((s, t) => s + t.amount, 0)
  const totalAdded = memberTxs.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0)
  const totalSpent = memberTxs.filter(t => t.type === 'deduction').reduce((s, t) => s + t.amount, 0)

  useEffect(() => {
    const h = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const handleSave = () => {
    const val = parseFloat(amount)
    if (!val || val <= 0) { setErr('Enter a valid amount'); return }
    const type = tab === 'cash' ? 'deposit' : 'deduction'
    const defaultNote = tab === 'cash' ? 'Cash added' : 'Expense'
    onAddTx({ id: Date.now() + Math.random(), memberId: member.id, type, amount: val, note: note.trim() || defaultNote, date: nowStr() })
    setAmount('')
    setNote('')
    setErr('')
    setFlash(true)
    setTimeout(() => setFlash(false), 2000)
  }

  const activeList = tab === 'cash' ? todayCash : (tab === 'expense' ? todayExp : [])
  const tabLabel = tab === 'cash' ? "Today's Cash Added" : "Today's Expenses"
  const tabSum = tab === 'cash' ? todayCashSum : todayExpSum
  const tabColor = tab === 'cash' ? 'text-emerald-400' : 'text-red-400'
  const tabBg = tab === 'cash' ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-red-500/10 border-red-500/25'
  const placeholder = tab === 'cash' ? 'Enter cash amount (₹)' : 'Enter expense amount (₹)'
  const noteHolder = tab === 'cash' ? 'Note e.g. Monthly share' : 'Note e.g. Groceries, Cooking gas'

  return (
    <div
      className="modal-bg fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-panel glass w-full sm:max-w-md sm:mx-4 sm:rounded-3xl rounded-t-3xl max-h-[94vh] flex flex-col overflow-hidden">

        {/* ── Gradient header ── */}
        <div className={`bg-gradient-to-br ${gradient} p-5 flex-shrink-0`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-white/25 flex items-center justify-center text-white font-black text-2xl uppercase shadow-lg flex-shrink-0">
              {member.name[0]}
            </div>
            <div className="flex-1">
              <p className="text-white/65 text-xs font-semibold uppercase tracking-widest">Member</p>
              <h2 className="text-white font-extrabold text-xl capitalize leading-tight">{member.name}</h2>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/35 flex items-center justify-center text-white text-lg transition-all flex-shrink-0">✕</button>
          </div>

          {/* Balance tiles */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/15 rounded-2xl p-3 text-center">
              <p className="text-white/60 text-xs leading-tight mb-1">Total Added</p>
              <p className="text-white font-bold text-base">+{fmt(totalAdded)}</p>
            </div>
            <div className="bg-white/15 rounded-2xl p-3 text-center">
              <p className="text-white/60 text-xs leading-tight mb-1">Total Spent</p>
              <p className="text-red-200 font-bold text-base">-{fmt(totalSpent)}</p>
            </div>
            <div className="bg-white/28 rounded-2xl p-3 text-center border border-white/35">
              <p className="text-white/70 text-xs leading-tight mb-1">Balance</p>
              <p className={`font-black text-base ${member.balance < 0 ? 'text-red-200' : 'text-white'}`}>
                {member.balance < 0 ? '-' : '+'}{fmt(member.balance)}
              </p>
            </div>
          </div>
        </div>

        {/* ── Today date bar ── */}
        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2 bg-white/2 flex-shrink-0">
          <span className="text-lg">📅</span>
          <div>
            <p className="text-white text-sm font-semibold leading-none">Today</p>
            <p className="text-slate-500 text-xs">{todayFull()}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <span className="text-xs bg-emerald-500/12 border border-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full font-bold">+{fmt(todayCashSum)}</span>
            <span className="text-xs bg-red-500/12 border border-red-500/20 text-red-400 px-2 py-1 rounded-full font-bold">-{fmt(todayExpSum)}</span>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 p-3 bg-white/2 border-b border-white/5 flex-shrink-0">
          {[
            { id: 'cash', icon: '💰', label: 'Add Cash' },
            { id: 'expense', icon: '📉', label: 'Add Expense' },
            { id: 'history', icon: '📋', label: 'All History' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setErr(''); setAmount(''); setNote('') }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${tab === t.id
                ? t.id === 'cash' ? 'bg-emerald-600 text-white' : t.id === 'expense' ? 'bg-red-600 text-white' : 'bg-violet-600 text-white'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                }`}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* ADD CASH / ADD EXPENSE tab */}
          {(tab === 'cash' || tab === 'expense') && (
            <>
              {/* Today's summary for this tab */}
              <div className={`rounded-2xl border p-4 ${tabBg}`}>
                <p className={`text-xs font-semibold mb-1 ${tabColor} opacity-80`}>{tabLabel}</p>
                <p className={`font-black text-2xl ${tabColor}`}>
                  {tab === 'cash' ? '+' : '-'}{fmt(tabSum)}
                </p>
                {activeList.length > 0 && (
                  <p className="text-slate-500 text-xs mt-1">{activeList.length} entr{activeList.length === 1 ? 'y' : 'ies'} today</p>
                )}
              </div>

              {/* Today's entries with edit */}
              {activeList.length > 0 && (
                <div className="space-y-2">
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Today's entries</p>
                  {[...activeList].reverse().map(tx => (
                    <EditableRow
                      key={tx.id}
                      tx={tx}
                      onSave={onEditTx}
                      onDelete={onDeleteTx}
                    />
                  ))}
                </div>
              )}

              {/* Add new form — admin only */}
              {isAdmin ? (
                <div className="space-y-2">
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    {tab === 'cash' ? '➕ Add new cash' : '➕ Add new expense'}
                  </p>
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    placeholder={placeholder}
                    value={amount}
                    onChange={e => { setAmount(e.target.value); setErr('') }}
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                    className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-3.5 text-white text-base placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:bg-white/10 transition-all"
                  />
                  <input
                    type="text"
                    placeholder={noteHolder}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                    className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-3.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:bg-white/10 transition-all"
                  />
                  {err && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{err}</p>}
                  <button
                    onClick={handleSave}
                    className={`btn-ripple w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-98 ${flash
                      ? 'bg-emerald-600 text-white'
                      : tab === 'cash'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/30'
                        : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-900/30'
                      }`}
                  >
                    {flash ? '✓ Saved!' : tab === 'cash' ? '💾 Save Cash' : '💾 Save Expense'}
                  </button>
                </div>
              ) : (
                <div className="text-center py-4 text-slate-600 text-sm">🔒 Admin login required to add entries</div>
              )}
            </>
          )}

          {/* HISTORY tab — all transactions */}
          {tab === 'history' && (
            <div className="space-y-2">
              {memberTxs.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-4xl mb-2">📭</div>
                  <p className="text-slate-500 text-sm">No transactions yet</p>
                </div>
              ) : (
                [...memberTxs].reverse().map(tx => (
                  <EditableRow
                    key={tx.id}
                    tx={tx}
                    onSave={onEditTx}
                    onDelete={onDeleteTx}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Safe area */}
        <div className="flex-shrink-0 h-3" />
      </div>
    </div>
  )
}

// ─── AdminLogin (FIXED - allows full password with special characters) ───────
function AdminLogin({ onSuccess, onClose }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const h = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const go = () => {
    if (pin === ADMIN_PIN) { onSuccess() }
    else { setErr('Wrong password. Try again.'); setPin('') }
  }

  return (
    <div
      className="modal-bg fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.87)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-panel glass w-full sm:max-w-sm sm:mx-4 sm:rounded-3xl rounded-t-3xl p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-3xl mx-auto mb-5 shadow-xl shadow-violet-900/50">🔐</div>
        <h3 className="text-white font-black text-xl mb-1">Admin Access</h3>
        <p className="text-slate-400 text-sm mb-6">Only <span className="text-violet-300 font-semibold">{ADMIN_NAME}</span> can make changes</p>

        {/* Fixed password input - now accepts ALL characters */}
        <div className="relative">
          <input
            autoFocus
            type={showPassword ? "text" : "password"}
            placeholder="Enter password"
            value={pin}
            onChange={e => { setPin(e.target.value); setErr('') }}
            onKeyDown={e => e.key === 'Enter' && go()}
            className="w-full bg-white/8 border border-white/12 rounded-2xl px-4 py-4 text-white text-center text-lg placeholder-slate-600 focus:outline-none focus:border-violet-500/70 transition-all mb-3"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-all text-xl"
          >
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>

        {err && <p className="text-red-400 text-sm mb-3 bg-red-500/10 rounded-xl py-2">{err}</p>}

        <button onClick={go} className="btn-ripple w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl py-4 font-bold text-lg mb-3 transition-all active:scale-98">
          Unlock
        </button>

        <button onClick={onClose} className="text-slate-500 text-sm hover:text-slate-300 transition-colors w-full py-2">Cancel</button>
        <div className="h-3" />
      </div>
    </div>
  )
}

// ─── MemberCard ───────────────────────────────────────────────────────────────
function MemberCard({ member, gradient, isAdmin, onClick, allTxs }) {
  const memberTxs = allTxs.filter(t => t.memberId === member.id)
  const todayTxs = memberTxs.filter(t => isToday(t.date))
  const todayCash = todayTxs.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0)
  const todaySpent = todayTxs.filter(t => t.type === 'deduction').reduce((s, t) => s + t.amount, 0)
  const isNeg = member.balance < 0
  const barPct = Math.min((Math.abs(member.balance) / 5000) * 100, 100)

  return (
    <div
      onClick={() => onClick(member)}
      className="glass rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:border-violet-500/30 hover:shadow-xl hover:shadow-violet-900/15 active:scale-98 select-none"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-lg sm:text-xl uppercase shadow flex-shrink-0`}>
          {member.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-white font-bold text-sm capitalize">{member.name}</p>
            {isAdmin && member.name === ADMIN_NAME && (
              <span className="text-xs bg-violet-500/25 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded-full">admin</span>
            )}
          </div>
          <p className="text-slate-600 text-xs">Tap for details</p>
        </div>
      </div>

      <p className={`text-xl sm:text-2xl font-black mb-2 ${isNeg ? 'text-red-400' : 'text-emerald-400'}`}>
        {isNeg ? '-' : '+'}{fmt(member.balance)}
      </p>

      <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden mb-2.5">
        {barPct > 0 && (
          <div className={`h-full rounded-full transition-all duration-700 ${isNeg ? 'bg-gradient-to-r from-red-500 to-rose-500' : 'bg-gradient-to-r from-emerald-400 to-teal-500'}`} style={{ width: `${barPct}%` }} />
        )}
      </div>

      {(todayCash > 0 || todaySpent > 0) ? (
        <div className="flex gap-1.5 flex-wrap">
          {todayCash > 0 && <span className="text-xs bg-emerald-500/12 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">+{fmt(todayCash)}</span>}
          {todaySpent > 0 && <span className="text-xs bg-red-500/12 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">-{fmt(todaySpent)}</span>}
        </div>
      ) : (
        <p className="text-slate-600 text-xs">{isNeg ? 'In debt' : 'In credit'}</p>
      )}
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(load)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const { transactions, deductCount } = data
  useEffect(() => { persist(data) }, [data])

  const members = useMemo(() => computeMembers(transactions), [transactions])
  const totalBalance = members.reduce((s, m) => s + m.balance, 0)
  const posCount = members.filter(m => m.balance >= 0).length

  // ── Add transaction ──
  const handleAddTx = useCallback((tx) => {
    setData(prev => ({ ...prev, transactions: [...prev.transactions, tx] }))
  }, [])

  // ── Edit transaction ──
  const handleEditTx = useCallback((id, newAmount, newNote) => {
    setData(prev => ({
      ...prev,
      transactions: prev.transactions.map(t => t.id === id ? { ...t, amount: newAmount, note: newNote } : t)
    }))
  }, [])

  // ── Delete transaction ──
  const handleDeleteTx = useCallback((id) => {
    setData(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) }))
  }, [])

  // ── Reset ──
  const handleReset = useCallback(() => {
    setData(defaultData())
    setSelectedMember(null)
    setShowResetConfirm(false)
  }, [])

  const activeMember = selectedMember ? members.find(m => m.id === selectedMember.id) : null

  return (
    <div className="min-h-screen bg-[#090912] pb-10">
      {/* Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-48 -left-48 w-96 h-96 bg-violet-700/12 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-48 w-96 h-96 bg-indigo-700/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-48 left-1/3 w-96 h-96 bg-purple-700/8 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-3 sm:px-6 pt-5">

        {/* ── Navbar ── */}
        <nav className="flex items-center justify-between mb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-violet-500/12 border border-violet-500/20 rounded-full px-3 py-1 text-violet-300 text-xs font-semibold uppercase tracking-wider mb-1.5">
              🏠 Room 9
            </div>
            <h1 className="text-2xl sm:text-4xl font-black gradient-text leading-tight">Expense Tracker</h1>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <>
                <span className="hidden sm:flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Admin: {ADMIN_NAME}
                </span>
                <button onClick={() => setIsAdmin(false)} className="bg-white/6 hover:bg-white/10 border border-white/8 text-slate-400 text-xs sm:text-sm px-3 py-2 rounded-xl transition-all">🔒 Lock</button>
              </>
            ) : (
              <button onClick={() => setShowLogin(true)} className="btn-ripple flex items-center gap-1.5 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-sm px-4 py-2.5 rounded-xl font-semibold transition-all">🔐 Admin</button>
            )}
          </div>
        </nav>

        {/* ── Stats ── */}
        <div className="glass glow-card rounded-2xl p-4 mb-4">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Group Balance</p>
          <p className={`text-3xl sm:text-4xl font-black ${totalBalance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {totalBalance < 0 ? '-' : '+'}{fmt(totalBalance)}
          </p>
          <div className="flex gap-3 mt-2 flex-wrap">
            <span className="text-xs text-slate-500"><span className="text-emerald-400 font-bold">{posCount}</span> in credit</span>
            <span className="text-xs text-slate-500"><span className="text-red-400 font-bold">{9 - posCount}</span> in debt</span>
          </div>
        </div>

        {/* ── Admin bar ── */}
        {isAdmin && (
          <div className="glass border border-violet-500/15 rounded-2xl p-3.5 mb-4 slide-down">
            <div className="flex items-center justify-between gap-2">
              <p className="text-slate-400 text-sm flex items-center gap-2">⚙️ <span className="font-medium">Admin Controls</span></p>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="btn-ripple px-4 py-2.5 rounded-2xl text-sm font-semibold text-red-400 border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 transition-all"
              >
                🗑 Reset All
              </button>
            </div>
          </div>
        )}

        {/* ── Members grid ── */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-bold text-base sm:text-lg">👥 All Members <span className="text-slate-600 font-normal text-xs sm:text-sm ml-1">tap to manage</span></h2>
          <span className="text-slate-600 text-xs">{todayFull().split(',')[0]}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {members.map((member, i) => (
            <MemberCard
              key={member.id}
              member={member}
              gradient={GRADIENTS[i]}
              isAdmin={isAdmin}
              onClick={setSelectedMember}
              allTxs={transactions}
            />
          ))}
        </div>

        {/* ── Recent activity ── */}
        {transactions.length > 0 && (
          <>
            <h2 className="text-white font-bold text-base sm:text-lg mb-3">
              📋 Recent Activity
              <span className="ml-2 bg-white/6 text-slate-400 text-xs px-2 py-0.5 rounded-full">{transactions.length}</span>
            </h2>
            <div className="glass rounded-2xl p-4 divide-y divide-white/4">
              {[...transactions].reverse().slice(0, 12).map(tx => {
                const m = members.find(x => x.id === tx.memberId)
                return (
                  <div key={tx.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 ${tx.type === 'deposit' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                      {tx.type === 'deposit' ? '💰' : '📉'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        <span className="capitalize text-slate-400">{m?.name}</span> – {tx.note}
                      </p>
                      <p className="text-slate-600 text-xs">{tx.date}</p>
                    </div>
                    <span className={`font-bold text-sm flex-shrink-0 ${tx.type === 'deposit' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {tx.type === 'deposit' ? '+' : '-'}{fmt(tx.amount)}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <p className="text-center text-slate-700 text-xs mt-8">Saved in browser · ₹100/day/person · 9 members</p>
      </div>

      {/* ── Reset confirm ── */}
      {showResetConfirm && (
        <div className="modal-bg fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}>
          <div className="modal-panel glass rounded-3xl p-8 w-full max-w-sm text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h3 className="text-white font-black text-xl mb-2">Reset All Data?</h3>
            <p className="text-slate-400 text-sm mb-6">This will delete ALL transactions and balances for all 9 members. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowResetConfirm(false)} className="flex-1 bg-white/8 hover:bg-white/12 text-slate-300 rounded-2xl py-3 font-semibold transition-all">Cancel</button>
              <button onClick={handleReset} className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-2xl py-3 font-bold transition-all">Yes, Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showLogin && <AdminLogin onSuccess={() => { setIsAdmin(true); setShowLogin(false) }} onClose={() => setShowLogin(false)} />}

      {activeMember && (
        <PersonModal
          member={activeMember}
          allTxs={transactions}
          gradient={GRADIENTS[activeMember.id - 1]}
          isAdmin={isAdmin}
          onClose={() => setSelectedMember(null)}
          onAddTx={handleAddTx}
          onEditTx={handleEditTx}
          onDeleteTx={handleDeleteTx}
        />
      )}
    </div>
  )
}