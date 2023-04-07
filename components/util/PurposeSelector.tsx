import * as React from 'react';

import { Box, Button, Grid, Stack, Textarea, Typography, useTheme } from '@mui/joy';
import { Input } from '@mui/material';
import { useActiveConfiguration } from '@/lib/store-chats';
import { SystemPurposeId, SystemPurposes } from '@/lib/data';

import { useTranslation } from 'next-i18next';


// Constants for tile sizes / grid width - breakpoints need to be computed here to work around
// the "flex box cannot shrink over wrapped content" issue
//
// Absolutely dislike this workaround, but it's the only way I found to make it work

const bpTileSize = { xs: 116, md: 125, xl: 130 };
const tileCols = [3, 4, 6];
const tileSpacing = 1;
const bpMaxWidth = Object.entries(bpTileSize).reduce((acc, [key, value], index) => {
  acc[key] = tileCols[index] * (value + 8 * tileSpacing) - 8 * tileSpacing;
  return acc;
}, {} as Record<string, number>);
const bpTileGap = { xs: 2, md: 3 };

/**
 * Purpose selector for the current chat. Clicking on any item activates it for the current chat.
 */
export function PurposeSelector() {
  // external state
  const theme = useTheme();
  const { setSystemPurposeId, systemPurposeId } = useActiveConfiguration();
  //use for search filter
  const [searchTerm, setSearchTerm] = React.useState('');
  //current page number for pagination
  const [page, setPage] = React.useState(1);
  //items per page
  const itemsPerPage = 16;

  const {t} = useTranslation('roles');
  
  const handlePurposeChange = (purpose: SystemPurposeId | null) => {
    if (purpose) setSystemPurposeId(purpose);
  };

  const handleCustomSystemMessageChange = (v: React.ChangeEvent<HTMLTextAreaElement>): void => {
    // TODO: persist this change? Right now it's reset every time.
    //       maybe we shall have a "save" button just save on a state to persist between sessions
    SystemPurposes['Custom'].systemMessage = v.target.value;
  };

  // Filter the list of purposes based on the search term and current page
  const filteredSystemPurposes = React.useMemo(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return Object.keys(SystemPurposes)
      .filter((spId) => SystemPurposes[spId as SystemPurposeId].title.toLowerCase().includes(lowerCaseSearchTerm))
      .sort((a, b) => SystemPurposes[a as SystemPurposeId].title.localeCompare(SystemPurposes[b as SystemPurposeId].title));
  }, [searchTerm]);

  //calculate total pages based on total filtered purposes
  const totalPages = Math.ceil(filteredSystemPurposes.length / itemsPerPage);
  
  // Calculate the paged list of purposes
  const pagedSystemPurposes = React.useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredSystemPurposes.slice(start, end);
  }, [filteredSystemPurposes, itemsPerPage, page]);

  const handlePreviousPage = () => {
    setPage((prevPage) => prevPage - 1);
  };

  const handleNextPage = () => {
    setPage((prevPage) => prevPage + 1);
  };

  return (
    <Stack direction="column" sx={{ minHeight: '60vh', justifyContent: 'center', alignItems: 'center' }}>
      <Box sx={{ maxWidth: bpMaxWidth }}>
        <Typography level="body3" color="neutral" sx={{ mb: 2 }}>
          AI purpose
        </Typography>

        <Grid container spacing={tileSpacing} sx={{ justifyContent: 'flex-start' }}>
          {pagedSystemPurposes.map((spId) => (
            <Grid key={spId}>
              <Button
                variant={systemPurposeId === spId ? 'solid' : 'soft'}
                color={systemPurposeId === spId ? 'primary' : 'neutral'}
                onClick={() => handlePurposeChange(spId as SystemPurposeId)}
                sx={{
                  flexDirection: 'column',
                  fontWeight: 500,
                  gap: bpTileGap,
                  height: bpTileSize,
                  width: bpTileSize,
                  ...(systemPurposeId !== spId ? {
                    boxShadow: theme.vars.shadow.md,
                    background: theme.vars.palette.background.level1,
                  } : {}),
                }}
              >
                <div style={{ fontSize: '2rem' }}>
                  {SystemPurposes[spId as SystemPurposeId]?.symbol}
                </div>
                <div>
                  {SystemPurposes[spId as SystemPurposeId]?.title}
                </div>
              </Button>
            </Grid>
          ))}
        </Grid>

        <Typography level="body2" sx={{ mt: 2 }}>
          {SystemPurposes[systemPurposeId].description}
        </Typography>

        {systemPurposeId === 'Custom' && (
          <Textarea
            variant='outlined' autoFocus placeholder={'Enter your custom system message here...'}
            minRows={3}
            defaultValue={SystemPurposes['Custom'].systemMessage} onChange={handleCustomSystemMessageChange}
            sx={{
              background: theme.vars.palette.background.level1,
              lineHeight: 1.75,
              mt: 1,
            }} />
        )}
        {/* Pagination */}
        {totalPages > 1 && (
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
            <Button disabled={page === 1} onClick={handlePreviousPage} sx={{ mr: 1 }}>
              Previous
            </Button>
            <Typography level="body2" sx={{ mr: 1 }}>
              Page {page} of {totalPages}
            </Typography>
            <Button disabled={page === totalPages} onClick={handleNextPage} sx={{ ml: 1 }}>
              Next
            </Button>
          </Box>
        )}

        {/* No results message */}
        {pagedSystemPurposes.length === 0 && (
          <Typography level="body2" sx={{ mt: 2 }}>
            No results found.
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
