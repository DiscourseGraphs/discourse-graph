import React from 'react';
import { useState } from 'react';
import {
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
} from '@mui/material';
import FeedbackIcon from '@mui/icons-material/Feedback';
import type { OnloadArgs } from 'roamjs-components/types';
import renderOverlay from "roamjs-components/util/renderOverlay";

type FeedbackType = 'question' | 'bug' | 'feedback' | 'other';
type Props = {
  onloadArgs: OnloadArgs;
};

function FeedbackComponent() {
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('feedback');
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    // TODO: Implement feedback submission logic here
    
    console.log({
      "roamjs-feedback": {
        type: feedbackType,
        message,
        page: window.location.href,
      },
    });
    
    setOpen(false);
    setMessage('');
  };

  return (
    <>
      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => setOpen(true)}
      >
        <FeedbackIcon />
      </Fab>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Feedback</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={feedbackType}
                label="Type"
                onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
              >
                <MenuItem value="question">Question</MenuItem>
                <MenuItem value="bug">Bug</MenuItem>
                <MenuItem value="feedback">Feedback</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Message"
              multiline
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            Send
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

const render = (props: Props) =>
  renderOverlay({
    Overlay: FeedbackComponent,
    props: {},
  });

export const SendFeedback = (onloadArgs: OnloadArgs) => {
  render({ onloadArgs });
};