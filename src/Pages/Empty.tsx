import { Button, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router";

export default function Empty() {
  const navigate = useNavigate();
  return (
    <Stack>
      <Typography>Empty page</Typography>
      <Button onClick={() => navigate("calendar")}>go to calendar</Button>
    </Stack>
  );
}
