import { useState } from "react";
import React from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import "./App.css";

function App() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const handleSelect = (e) => {
    const file = Array.from(e.target.files);
    console.log("file", file);
    setSelectedFiles([...selectedFiles, ...file]);
    console.log(selectedFiles);
  };
  return (
    <>
      <Card className="w-2xl h-64 flex p-10 justify-between">
        <CardDescription>
          Add the file you want to add <br />
          Only accepts PDF, PNG, JPG, JPEG
        </CardDescription>
        <div>
          <Button asChild>
            <label htmlFor="file-upload" className="cursor-pointer">
              Select Files
              <input
                id="file-upload"
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  handleSelect(e);
                }}
              />
            </label>
          </Button>
        </div>
        {selectedFiles.length > 0 && (
          <CardDescription>
            {selectedFiles.map((file, index) => (
              <span key={index}>
                {file.name}
                <br />
              </span>
            ))}
          </CardDescription>
        )}
      </Card>
    </>
  );
}

export default App;
