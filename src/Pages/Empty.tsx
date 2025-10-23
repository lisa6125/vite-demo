import { Button, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router";
import math from "../utils";

export default function Empty() {
  const [count, setCount] = useState(0);
  const navigate = useNavigate();
  const handleCount = () => {
    setCount(math.add(count));
  };
  return (
    <Stack>
      <Typography>Empty page</Typography>
      <Button
        onClick={() => {
          navigate("calendar");
          handleCount();
        }}
      >
        go to calendar
      </Button>
    </Stack>
  );
}
