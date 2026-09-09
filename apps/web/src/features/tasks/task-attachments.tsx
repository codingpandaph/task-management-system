import AttachFileOutlined from '@mui/icons-material/AttachFileOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { ModalForm } from '../hr/ui';

type Attachment = { id: string; name: string; url: string };
export function TaskAttachments({
  taskId,
  attachments,
  add,
}: {
  taskId: string;
  attachments: Attachment[];
  add: (path: string, body: unknown) => Promise<void>;
}) {
  return (
    <Box>
      <Typography variant="overline">Attachments</Typography>
      {attachments.map((attachment) => (
        <Button
          key={attachment.id}
          component="a"
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<AttachFileOutlined />}
          sx={{ display: 'flex', width: 'fit-content' }}
        >
          {attachment.name}
        </Button>
      ))}
      {!attachments.length && (
        <Typography variant="body2" color="text.secondary">
          No attachments
        </Typography>
      )}
      <ModalForm
        buttonLabel="Add attachment"
        icon={<AttachFileOutlined />}
        title="Link an attachment"
        description="For this prototype, attachments use secure links rather than storing files."
        fields={[
          { name: 'name', label: 'File name' },
          { name: 'url', label: 'Secure link', type: 'url' },
          { name: 'mediaType', label: 'File type', value: 'application/pdf' },
          { name: 'sizeBytes', label: 'File size in bytes', type: 'number', value: 1 },
        ]}
        onSubmit={(values) => add(`tasks/${taskId}/attachments`, values)}
      />
    </Box>
  );
}
