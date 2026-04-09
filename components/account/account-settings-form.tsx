"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";

import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AccountProfile, AccountProfileResponse } from "@/types/account";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

const CROPPER_SIZE = 280;
const OUTPUT_SIZE = 256;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function createImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load selected image."));
    image.src = src;
  });
}

export function AccountSettingsForm({ account }: { account: AccountProfile }) {
  const { update } = useSession();
  const [savedAccount, setSavedAccount] = useState(account);
  const [displayName, setDisplayName] = useState(account.displayName);
  const [phoneNumber, setPhoneNumber] = useState(account.phoneNumber ?? "");
  const [profileImageUrl, setProfileImageUrl] = useState(account.profileImageUrl);
  const [editorImageUrl, setEditorImageUrl] = useState<string | null>(account.profileImageUrl);
  const [imageScale, setImageScale] = useState(1);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: CROPPER_SIZE, height: CROPPER_SIZE });
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; startX: number; startY: number } | null>(null);

  const hasChanges =
    displayName.trim() !== savedAccount.displayName ||
    phoneNumber.trim() !== (savedAccount.phoneNumber ?? "") ||
    profileImageUrl !== savedAccount.profileImageUrl;

  const scaledImageSize = useMemo(
    () => ({
      width: imageNaturalSize.width * imageScale,
      height: imageNaturalSize.height * imageScale
    }),
    [imageNaturalSize, imageScale]
  );

  useEffect(() => {
    async function syncImageSize() {
      if (!editorImageUrl) {
        setImageNaturalSize({ width: CROPPER_SIZE, height: CROPPER_SIZE });
        setImageOffset({ x: 0, y: 0 });
        setImageScale(1);
        return;
      }

      try {
        const image = await createImageElement(editorImageUrl);
        const baseScale = Math.max(CROPPER_SIZE / image.width, CROPPER_SIZE / image.height);
        const fittedWidth = image.width * baseScale;
        const fittedHeight = image.height * baseScale;

        setImageNaturalSize({ width: fittedWidth, height: fittedHeight });
        setImageScale(1);
        setImageOffset({
          x: (CROPPER_SIZE - fittedWidth) / 2,
          y: (CROPPER_SIZE - fittedHeight) / 2
        });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load selected image.");
      }
    }

    void syncImageSize();
  }, [editorImageUrl]);

  useEffect(() => {
    if (!scaledImageSize.width || !scaledImageSize.height) {
      return;
    }

    const minX = Math.min(0, CROPPER_SIZE - scaledImageSize.width);
    const minY = Math.min(0, CROPPER_SIZE - scaledImageSize.height);

    setImageOffset((current) => ({
      x: clamp(current.x, minX, 0),
      y: clamp(current.y, minY, 0)
    }));
  }, [scaledImageSize.height, scaledImageSize.width]);

  async function commitCroppedImage() {
    if (!editorImageUrl) {
      setProfileImageUrl(null);
      return null;
    }

    const image = await createImageElement(editorImageUrl);
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Unable to prepare the image crop.");
    }

    const displayScaleX = scaledImageSize.width / image.width;
    const displayScaleY = scaledImageSize.height / image.height;
    const sourceX = Math.max(0, -imageOffset.x / displayScaleX);
    const sourceY = Math.max(0, -imageOffset.y / displayScaleY);
    const sourceWidth = Math.min(image.width - sourceX, CROPPER_SIZE / displayScaleX);
    const sourceHeight = Math.min(image.height - sourceY, CROPPER_SIZE / displayScaleY);

    context.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    const nextProfileImageUrl = canvas.toDataURL("image/png");
    setProfileImageUrl(nextProfileImageUrl);
    return nextProfileImageUrl;
  }

  async function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please choose an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setErrorMessage(null);
      setSuccessMessage(null);
      setEditorImageUrl(typeof reader.result === "string" ? reader.result : null);
      event.target.value = "";
    };
    reader.onerror = () => {
      setErrorMessage("Unable to read the selected image.");
      event.target.value = "";
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const nextProfileImageUrl = editorImageUrl ? await commitCroppedImage() : null;
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          displayName,
          phoneNumber,
          profileImageUrl: editorImageUrl ? nextProfileImageUrl : profileImageUrl
        })
      });

      const data = await parseJsonResponse<AccountProfileResponse>(response);

      setSavedAccount(data.account);
      setDisplayName(data.account.displayName);
      setPhoneNumber(data.account.phoneNumber ?? "");
      setProfileImageUrl(data.account.profileImageUrl);
      setEditorImageUrl(data.account.profileImageUrl);
      setSuccessMessage("Account settings updated.");
      await update({
        user: {
          displayName: data.account.displayName
        }
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update account settings.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="brand-surface">
      <CardHeader>
        <CardTitle>Account Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="account-display-name">
              Display name
            </label>
            <Input
              id="account-display-name"
              onChange={(event) => setDisplayName(event.target.value)}
              value={displayName}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="account-email">
              Email
            </label>
            <Input id="account-email" readOnly value={account.email} />
            <p className="text-sm text-muted-foreground">Email is currently read-only in this account flow.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="account-phone">
              Phone number
            </label>
            <Input
              id="account-phone"
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="Optional phone number"
              type="tel"
              value={phoneNumber}
            />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Profile picture</label>
            <div className="rounded-3xl border border-border/80 bg-slate-50/70 p-4 sm:p-5">
              <div className="grid gap-8 lg:grid-cols-[440px_320px] lg:justify-center lg:items-center">
                <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <div
                        className="relative h-[280px] w-[280px] overflow-hidden rounded-3xl border border-border bg-slate-950/5"
                        onPointerDown={(event) => {
                          if (!editorImageUrl) {
                            return;
                          }

                          dragStartRef.current = {
                            pointerX: event.clientX,
                            pointerY: event.clientY,
                            startX: imageOffset.x,
                            startY: imageOffset.y
                          };
                          setIsDragging(true);
                        }}
                        onPointerMove={(event) => {
                          if (!dragStartRef.current || !editorImageUrl) {
                            return;
                          }

                          const nextX = dragStartRef.current.startX + (event.clientX - dragStartRef.current.pointerX);
                          const nextY = dragStartRef.current.startY + (event.clientY - dragStartRef.current.pointerY);
                          const minX = Math.min(0, CROPPER_SIZE - scaledImageSize.width);
                          const minY = Math.min(0, CROPPER_SIZE - scaledImageSize.height);

                          setImageOffset({
                            x: clamp(nextX, minX, 0),
                            y: clamp(nextY, minY, 0)
                          });
                        }}
                        onPointerUp={() => {
                          dragStartRef.current = null;
                          setIsDragging(false);
                        }}
                        onPointerLeave={() => {
                          dragStartRef.current = null;
                          setIsDragging(false);
                        }}
                      >
                        {editorImageUrl ? (
                          <img
                            alt="Profile crop preview"
                            className={cn("absolute max-w-none select-none touch-none", isDragging ? "cursor-grabbing" : "cursor-grab")}
                            draggable={false}
                            src={editorImageUrl}
                            style={{
                              width: `${scaledImageSize.width}px`,
                              height: `${scaledImageSize.height}px`,
                              left: `${imageOffset.x}px`,
                              top: `${imageOffset.y}px`
                            }}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center px-8 text-center text-sm text-muted-foreground">
                            Upload a profile image, then drag it behind the circle to choose how your account icon frames it.
                          </div>
                        )}
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,transparent_95px,rgba(2,6,23,0.62)_96px)]" />
                        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[192px] w-[192px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_9999px_rgba(2,6,23,0.22)]" />
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-full max-w-[280px] space-y-2">
                        <label className="block text-sm font-medium text-foreground" htmlFor="account-image-scale">
                          Zoom
                        </label>
                        <Input
                          id="account-image-scale"
                          max="2.5"
                          min="1"
                          onChange={(event) => setImageScale(Number(event.target.value))}
                          step="0.01"
                          type="range"
                          value={imageScale}
                        />
                      </div>
                      <div className="flex flex-wrap justify-center gap-3">
                        <label className="inline-flex cursor-pointer items-center">
                          <span className="sr-only">Upload profile image</span>
                          <Input accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileSelection} type="file" />
                          <span className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-[0_14px_30px_-18px_rgba(14,99,39,0.75)]">
                            Upload Photo
                          </span>
                        </label>
                        <Button
                          disabled={!editorImageUrl}
                          onClick={() => void commitCroppedImage()}
                          type="button"
                          variant="secondary"
                        >
                          Apply Crop
                        </Button>
                        <Button
                          disabled={!profileImageUrl && !editorImageUrl}
                          onClick={() => {
                            setProfileImageUrl(null);
                            setEditorImageUrl(null);
                          }}
                          type="button"
                          variant="outline"
                        >
                          Remove Photo
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4 rounded-2xl border border-border bg-background p-4 shadow-sm">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">Icon Preview</div>
                    <p className="text-sm text-muted-foreground">This updates live based on the photo framing you choose.</p>
                  </div>
                  <div className="flex items-center gap-5">
                    <ProfileAvatar
                      className="h-24 w-24 border-slate-300 bg-slate-100 text-slate-700"
                      fallbackClassName="text-xl"
                      imageUrl={profileImageUrl}
                      name={displayName || account.displayName}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">This preview matches the circular account icon used across the app.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <CardFooter className="px-0 pb-0 pt-2">
            <Button disabled={isSubmitting || !hasChanges || !displayName.trim()} type="submit">
              Save Changes
            </Button>
          </CardFooter>
        </form>
      </CardContent>
      {(errorMessage || successMessage) ? (
        <CardFooter className="pt-0 text-sm text-muted-foreground">
          <p className={errorMessage ? "text-red-600" : "text-emerald-700"}>{errorMessage ?? successMessage}</p>
        </CardFooter>
      ) : null}
    </Card>
  );
}
