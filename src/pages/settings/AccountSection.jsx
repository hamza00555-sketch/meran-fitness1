// ── Settings › الحساب والمستخدمون ─────────────────────────────
// The name, and the people who share this phone. Switching or adding a
// user reloads the app on purpose: every piece of state is per user and
// read once at boot.

import { useState } from 'react'
import { ListGroup, IconButton, Button, ConfirmSheet } from '../../components/kit/index.jsx'
import { Plus, Trash, User, Users } from '../../components/kit/icons.js'
import { CheckRow, TextField, Ar } from './parts.jsx'
import { uid, getUsers, saveUsers, switchUser, getCurrentUserId, deleteUserData } from '../../utils.js'

export default function AccountSection({ profile, update }) {
  const [nameInput, setNameInput] = useState(profile?.name || '')
  const [users, setUsers] = useState(getUsers)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [doomed, setDoomed] = useState(null)
  const currentUserId = getCurrentUserId()

  const saveName = () => {
    const n = nameInput.trim()
    if (n && n !== profile?.name) update('name', n)
  }

  const handleSwitchUser = (id) => {
    if (id === currentUserId) return
    switchUser(id)
    window.location.reload()
  }

  const handleAddUser = () => {
    const name = newName.trim()
    if (!name) return
    const u = { id: uid(), name }
    saveUsers([...users, u])
    switchUser(u.id)
    window.location.reload()
  }

  const handleDeleteUser = (id) => {
    if (id === currentUserId) return
    deleteUserData(id)
    const next = users.filter(u => u.id !== id)
    saveUsers(next)
    setUsers(next)
    setDoomed(null)
  }

  // The active person is named by their profile, not by the registry's
  // «المستخدم الرئيسي» — one identity, not two (critique F44).
  const nameOf = (u) => (u.id === currentUserId && profile?.name) ? profile.name : u.name
  const doomedUser = users.find(u => u.id === doomed)

  return (
    <>
      <div className="st-fields one" style={{ marginTop: 0 }}>
        <TextField label="اسمك" value={nameInput} autoComplete="name" enterKeyHint="done"
          placeholder="وش نناديك؟"
          onChange={e => setNameInput(e.target.value)}
          onBlur={saveName}
          onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }} />
      </div>

      <ListGroup header="المستخدمون" footer="كل مستخدم له جلساته وأوزانه وخطته لحاله. اضغط على الاسم وتنتقل له.">
        <div role="radiogroup" aria-label="المستخدمون">
          {users.map(u => {
            const isActive = u.id === currentUserId
            return (
              <div key={u.id} className="st-split">
                <CheckRow leading={isActive ? User : Users} title={nameOf(u)}
                  subtitle={isActive ? 'أنت الحين' : null}
                  checked={isActive} onClick={() => handleSwitchUser(u.id)} />
                {!isActive && (
                  <IconButton icon={Trash} label={`حذف ${u.name}`} onClick={() => setDoomed(u.id)} />
                )}
              </div>
            )
          })}
        </div>
        {adding ? (
          <div className="st-inline-add">
            <TextField label="اسم المستخدم الجديد" value={newName} autoFocus enterKeyHint="done"
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddUser(); if (e.key === 'Escape') { setAdding(false); setNewName('') } }} />
            <Button variant="primary" onClick={handleAddUser} disabled={!newName.trim()}>أضف</Button>
          </div>
        ) : (
          <button type="button" className="k-row k-row-tap st-accent" onClick={() => setAdding(true)}>
            <span className="k-row-icon"><Plus size={22} weight="bold" aria-hidden="true" /></span>
            <span className="k-row-main"><span className="k-row-title">إضافة مستخدم</span></span>
          </button>
        )}
      </ListGroup>

      <ConfirmSheet open={!!doomed} onClose={() => setDoomed(null)} destructive
        title={doomedUser ? `تحذف ${doomedUser.name}؟` : 'تحذف المستخدم؟'}
        message={<Ar>{'تنحذف جلساته وأوزانه وخطته من هذا الجوال، وما ترجع.'}</Ar>}
        confirmLabel="احذف المستخدم"
        onConfirm={() => handleDeleteUser(doomed)} />
    </>
  )
}
