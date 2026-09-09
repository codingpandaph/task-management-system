import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

function inline(source: string): ReactNode[] {
  const tokens = source.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g);
  return tokens.map((token, index) => {
    if (token.startsWith('`') && token.endsWith('`')) return <code key={index}>{token.slice(1, -1)}</code>;
    if (token.startsWith('**') && token.endsWith('**')) return <strong key={index}>{token.slice(2, -2)}</strong>;
    const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link) {
      return (
        <Link key={index} href={link[2]} target="_blank" rel="noopener noreferrer">
          {link[1]}
        </Link>
      );
    }
    return token;
  });
}

export function TaskMarkdown({ source }: { source: string }) {
  if (!source.trim()) return <Typography color="text.secondary">No description yet.</Typography>;
  const lines = source.split('\n');
  return (
    <Box className="task-markdown">
      {lines.map((line, index) => {
        if (line.startsWith('### '))
          return (
            <Typography key={index} variant="subtitle1">
              {inline(line.slice(4))}
            </Typography>
          );
        if (line.startsWith('## '))
          return (
            <Typography key={index} variant="h6">
              {inline(line.slice(3))}
            </Typography>
          );
        if (line.startsWith('# '))
          return (
            <Typography key={index} variant="h5">
              {inline(line.slice(2))}
            </Typography>
          );
        if (/^[-*] /.test(line))
          return (
            <Typography key={index} component="li">
              {inline(line.slice(2))}
            </Typography>
          );
        if (!line.trim()) return <Box key={index} sx={{ height: 8 }} />;
        return <Typography key={index}>{inline(line)}</Typography>;
      })}
    </Box>
  );
}
