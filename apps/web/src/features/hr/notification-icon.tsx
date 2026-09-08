import NotificationsNoneOutlined from '@mui/icons-material/NotificationsNoneOutlined';
import Badge from '@mui/material/Badge';

export function NotificationIcon({ unread }: { unread: number }) {
  return (
    <span aria-hidden="true" title={`${unread} unread notifications`}>
      <Badge badgeContent={unread} color="error" max={99}>
        <NotificationsNoneOutlined />
      </Badge>
    </span>
  );
}
