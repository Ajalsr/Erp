import axios from 'axios'
import useAuthStore from '../store/useAuthStore'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const useOrganization = () => {
  const token = useAuthStore((s) => s.token)
  const setActiveOrg = useAuthStore((s) => s.setActiveOrg)
  const setOrganizations = useAuthStore((s) => s.setOrganizations)

  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${token}` },
  })

  // ── Organizations ─────────────────────────────────────────────

  const createOrganization = async ({ name, description }) => {
    const res = await axios.post(
      `${BASE_URL}/api/organizations`,
      { name, description },
      authHeaders()
    )
    return res.data
  }

  const getMyOrganizations = async () => {
    const res = await axios.get(`${BASE_URL}/api/organizations`, authHeaders())
    const orgs = res.data.data || []
    setOrganizations(orgs)
    return orgs
  }

  const getOrganization = async (id) => {
    const res = await axios.get(`${BASE_URL}/api/organizations/${id}`, authHeaders())
    return res.data.data
  }

  const updateOrganization = async (id, { name, description }) => {
    const res = await axios.put(
      `${BASE_URL}/api/organizations/${id}`,
      { name, description },
      authHeaders()
    )
    return res.data
  }

  const deleteOrganization = async (id) => {
    const res = await axios.delete(`${BASE_URL}/api/organizations/${id}`, authHeaders())
    return res.data
  }

  // ── Members ──────────────────────────────────────────────────

  const getMembers = async (orgId) => {
    const res = await axios.get(`${BASE_URL}/api/organizations/${orgId}/members`, authHeaders())
    return res.data.data || []
  }

  const inviteMember = async (orgId, { email, role }) => {
    const res = await axios.post(
      `${BASE_URL}/api/organizations/${orgId}/invite`,
      { email, role },
      authHeaders()
    )
    return res.data
  }

  const updateMemberRole = async (orgId, userId, role) => {
    const res = await axios.put(
      `${BASE_URL}/api/organizations/${orgId}/members/${userId}/role`,
      { role },
      authHeaders()
    )
    return res.data
  }

  const removeMember = async (orgId, userId) => {
    const res = await axios.delete(
      `${BASE_URL}/api/organizations/${orgId}/members/${userId}`,
      authHeaders()
    )
    return res.data
  }

  // ── Invitations ──────────────────────────────────────────────

  const getOrgInvitations = async (orgId) => {
    const res = await axios.get(
      `${BASE_URL}/api/organizations/${orgId}/invitations`,
      authHeaders()
    )
    return res.data.data || []
  }

  const cancelInvitation = async (orgId, invitationId) => {
    const res = await axios.delete(
      `${BASE_URL}/api/organizations/${orgId}/invitations/${invitationId}`,
      authHeaders()
    )
    return res.data
  }

  const getMyInvitations = async () => {
    const res = await axios.get(`${BASE_URL}/api/users/invitations`, authHeaders())
    return res.data.data || []
  }

  const acceptInvitation = async (token) => {
    const res = await axios.post(
      `${BASE_URL}/api/invitations/accept`,
      { token },
      authHeaders()
    )
    return res.data
  }

  const getInvitationByToken = async (token) => {
    const res = await axios.get(`${BASE_URL}/api/invitations/${token}`)
    return res.data.data
  }

  // ── Helpers ──────────────────────────────────────────────────

  const switchOrganization = (org) => {
    setActiveOrg(org)
  }

  return {
    createOrganization,
    getMyOrganizations,
    getOrganization,
    updateOrganization,
    deleteOrganization,
    getMembers,
    inviteMember,
    updateMemberRole,
    removeMember,
    getOrgInvitations,
    cancelInvitation,
    getMyInvitations,
    acceptInvitation,
    getInvitationByToken,
    switchOrganization,
  }
}

export default useOrganization
