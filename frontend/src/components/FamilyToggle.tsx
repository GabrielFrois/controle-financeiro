import { Box, Typography, Avatar, AvatarGroup, Tooltip, Chip, Stack } from '@mui/material';
import { useFamily } from '../context/FamilyContext';
import { useAuth } from '../context/AuthContext';
import PersonIcon from '@mui/icons-material/Person';
import GroupsIcon from '@mui/icons-material/Groups';

export default function FamilyToggle() {
  const { user }                                    = useAuth();
  const { families, viewMode, setViewMode }         = useFamily();

  if (families.length === 0) return null;

  return (
    <Box sx={{ px: 1.5, py: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1.5, px: 0.5 }}>
        <GroupsIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
        <Typography variant="caption" color="text.disabled" fontWeight={700}
          sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: '0.65rem' }}>
          Visão
        </Typography>
      </Stack>

      <Stack spacing={0.5}>
        {/* ── Só eu ─────────────────────────────────────────────────────── */}
        <Box
          onClick={() => setViewMode('personal')}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: 1.5, py: 1,
            borderRadius: 2,
            cursor: 'pointer',
            transition: 'all 0.15s',
            bgcolor: viewMode === 'personal' ? 'primary.main' : 'transparent',
            '&:hover': {
              bgcolor: viewMode === 'personal' ? 'primary.dark' : 'action.hover',
            },
          }}
        >
          <Avatar
            sx={{
              width: 28, height: 28, fontSize: 13,
              bgcolor: viewMode === 'personal' ? 'white' : (user?.color ?? 'primary.main'),
              color: viewMode === 'personal' ? (user?.color ?? 'primary.main') : 'white',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {user?.name?.[0]?.toUpperCase() ?? <PersonIcon sx={{ fontSize: 16 }} />}
          </Avatar>
          <Typography
            variant="body2"
            fontWeight={viewMode === 'personal' ? 700 : 500}
            noWrap
            sx={{ color: viewMode === 'personal' ? 'white' : 'text.primary', fontSize: '0.82rem' }}
          >
            Só eu
          </Typography>
          {viewMode === 'personal' && (
            <Chip
              label="ativo"
              size="small"
              sx={{
                ml: 'auto', height: 18, fontSize: '0.6rem', fontWeight: 700,
                bgcolor: 'rgba(255,255,255,0.25)', color: 'white',
                '& .MuiChip-label': { px: 1 },
              }}
            />
          )}
        </Box>

        {/* ── Famílias ──────────────────────────────────────────────────── */}
        {families.map((fam) => {
          const isActive = viewMode === fam.id;
          return (
            <Tooltip key={fam.id} title={fam.members.map((m) => m.name).join(' · ')} placement="right" arrow>
              <Box
                onClick={() => setViewMode(fam.id)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  px: 1.5, py: 1,
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  bgcolor: isActive ? 'primary.main' : 'transparent',
                  '&:hover': {
                    bgcolor: isActive ? 'primary.dark' : 'action.hover',
                  },
                }}
              >
                <AvatarGroup
                  max={3}
                  sx={{
                    flexShrink: 0,
                    '& .MuiAvatar-root': {
                      width: 22, height: 22, fontSize: 10, fontWeight: 700,
                      border: isActive ? '1.5px solid white' : '1.5px solid transparent',
                    },
                  }}
                >
                  {fam.members.map((m) => (
                    <Avatar key={m.id} sx={{ bgcolor: m.color }}>{m.name[0]}</Avatar>
                  ))}
                </AvatarGroup>

                <Typography
                  variant="body2"
                  fontWeight={isActive ? 700 : 500}
                  noWrap
                  sx={{ color: isActive ? 'white' : 'text.primary', fontSize: '0.82rem', flex: 1, minWidth: 0 }}
                >
                  {fam.name}
                </Typography>

                {isActive && (
                  <Chip
                    label="ativo"
                    size="small"
                    sx={{
                      ml: 'auto', height: 18, fontSize: '0.6rem', fontWeight: 700,
                      bgcolor: 'rgba(255,255,255,0.25)', color: 'white',
                      flexShrink: 0,
                      '& .MuiChip-label': { px: 1 },
                    }}
                  />
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Stack>
    </Box>
  );
}