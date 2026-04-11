"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length === 0) {
    return "";
  }

  if (digits.length <= 3) {
    return `(${digits}`;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function AccountSettingsForm({ account }: { account: AccountProfile }) {
  const { update } = useSession();
  const cropperRef = useRef<HTMLDivElement | null>(null);
  const [savedAccount, setSavedAccount] = useState(account);
  const [displayName, setDisplayName] = useState(account.displayName);
  const [email, setEmail] = useState(account.email);
  const [phoneNumber, setPhoneNumber] = useState(formatPhoneNumber(account.phoneNumber ?? ""));
  const [profileImageUrl, setProfileImageUrl] = useState(account.profileImageUrl);
  const [editorImageUrl, setEditorImageUrl] = useState<string | null>(account.profileImageUrl);
  const [imageScale, setImageScale] = useState(1);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: CROPPER_SIZE, height: CROPPER_SIZE });
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmNextPassword, setConfirmNextPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNextPassword, setShowNextPassword] = useState(false);
  const [showConfirmNextPassword, setShowConfirmNextPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [passwordErrorMessage, setPasswordErrorMessage] = useState<string | null>(null);
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState<string | null>(null);
  const dragStartRef = useRef<{ pointerId: number; pointerX: number; pointerY: number; startX: number; startY: number } | null>(null);

  const hasChanges =
    displayName.trim() !== savedAccount.displayName ||
    email.trim().toLowerCase() !== savedAccount.email.toLowerCase() ||
    phoneNumber.trim() !== formatPhoneNumber(savedAccount.phoneNumber ?? "") ||
    profileImageUrl !== savedAccount.profileImageUrl;
  const passwordResetMatches = nextPassword === confirmNextPassword;
  const canSubmitPasswordReset =
    currentPassword.length > 0 && nextPassword.length > 0 && confirmNextPassword.length > 0 && passwordResetMatches;

  useEffect(() => {
    setIsClient(true);
  }, []);

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

  async function renderCroppedImage() {
    if (!editorImageUrl) {
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
    return canvas.toDataURL("image/png");
  }

  useEffect(() => {
    let isActive = true;

    async function syncCroppedPreview() {
      if (!editorImageUrl) {
        setProfileImageUrl(null);
        return;
      }

      try {
        const nextProfileImageUrl = await renderCroppedImage();

        if (isActive) {
          setProfileImageUrl(nextProfileImageUrl);
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to prepare the image crop.");
        }
      }
    }

    void syncCroppedPreview();

    return () => {
      isActive = false;
    };
  }, [editorImageUrl, imageOffset.x, imageOffset.y, imageScale, imageNaturalSize.height, imageNaturalSize.width]);

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

  function handleScaleChange(nextScale: number) {
    if (!Number.isFinite(nextScale)) {
      return;
    }

    setImageScale((currentScale) => {
      const clampedScale = clamp(nextScale, 1, 2.5);

      setImageOffset((currentOffset) => {
        const currentWidth = imageNaturalSize.width * currentScale;
        const currentHeight = imageNaturalSize.height * currentScale;
        const nextWidth = imageNaturalSize.width * clampedScale;
        const nextHeight = imageNaturalSize.height * clampedScale;
        const centerX = CROPPER_SIZE / 2;
        const centerY = CROPPER_SIZE / 2;
        const focalX = (centerX - currentOffset.x) / currentWidth;
        const focalY = (centerY - currentOffset.y) / currentHeight;
        const minX = Math.min(0, CROPPER_SIZE - nextWidth);
        const minY = Math.min(0, CROPPER_SIZE - nextHeight);

        return {
          x: clamp(centerX - focalX * nextWidth, minX, 0),
          y: clamp(centerY - focalY * nextHeight, minY, 0)
        };
      });

      return clampedScale;
    });
  }

  function handlePointerStart(event: React.PointerEvent<HTMLDivElement>) {
    if (!editorImageUrl) {
      return;
    }

    dragStartRef.current = {
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: imageOffset.x,
      startY: imageOffset.y
    };
    cropperRef.current?.setPointerCapture(event.pointerId);
    setIsDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
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
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (dragStartRef.current?.pointerId === event.pointerId) {
      cropperRef.current?.releasePointerCapture(event.pointerId);
      dragStartRef.current = null;
      setIsDragging(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          displayName,
          email,
          phoneNumber,
          profileImageUrl
        })
      });

      const data = await parseJsonResponse<AccountProfileResponse>(response);

      setSavedAccount(data.account);
      setDisplayName(data.account.displayName);
      setEmail(data.account.email);
      setPhoneNumber(formatPhoneNumber(data.account.phoneNumber ?? ""));
      setProfileImageUrl(data.account.profileImageUrl);
      setEditorImageUrl(data.account.profileImageUrl);
      setSuccessMessage("Account settings updated.");
      await update({
        user: {
          displayName: data.account.displayName,
          email: data.account.email
        }
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update account settings.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordErrorMessage(null);
    setPasswordSuccessMessage(null);

    if (!passwordResetMatches) {
      setPasswordErrorMessage("New passwords must match.");
      return;
    }

    setIsPasswordSubmitting(true);

    try {
      const response = await fetch("/api/account/password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          currentPassword,
          nextPassword
        })
      });

      await parseJsonResponse<{ success: true }>(response);
      setCurrentPassword("");
      setNextPassword("");
      setConfirmNextPassword("");
      setShowCurrentPassword(false);
      setShowNextPassword(false);
      setShowConfirmNextPassword(false);
      setPasswordSuccessMessage("Password updated.");
      setSuccessMessage("Password updated.");
      setIsPasswordModalOpen(false);
    } catch (error) {
      setPasswordErrorMessage(error instanceof Error ? error.message : "Unable to update password.");
    } finally {
      setIsPasswordSubmitting(false);
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
            <Input
              id="account-email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="account-phone">
              Phone number
            </label>
            <Input
              id="account-phone"
              onChange={(event) => setPhoneNumber(formatPhoneNumber(event.target.value))}
              placeholder="Ex: (555) 123-4567"
              type="tel"
              value={phoneNumber}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="account-password-saved">
              Password
            </label>
            <Input
              className="bg-slate-100 text-slate-500"
              id="account-password-saved"
              readOnly
              type="password"
              value="PasswordSaved123!"
            />
            <div>
              <button
                className="text-sm font-semibold text-[#1846d1] underline underline-offset-2 transition-colors hover:text-[#0f348f]"
                onClick={() => {
                  setPasswordErrorMessage(null);
                  setPasswordSuccessMessage(null);
                  setIsPasswordModalOpen(true);
                }}
                type="button"
              >
                Reset Password
              </button>
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Profile picture</label>
            <div className="rounded-3xl border border-border/80 bg-slate-50/70 p-4 sm:p-5">
              <div className="grid gap-8 lg:grid-cols-[440px_320px] lg:justify-center lg:items-center">
                <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
                  <div className="space-y-4">
                    <div className="flex justify-center">
                    <div
                      ref={cropperRef}
                      className="relative h-[280px] w-[280px] overflow-hidden rounded-3xl border border-border bg-slate-950/5"
                      onPointerCancel={handlePointerEnd}
                      onPointerDown={handlePointerStart}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerEnd}
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
                          onChange={(event) => handleScaleChange(event.target.valueAsNumber)}
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
            <Button
              disabled={isSubmitting || !displayName.trim() || !email.trim() || !hasChanges}
              type="submit"
            >
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
      {isClient && isPasswordModalOpen
        ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-lg rounded-[1.75rem] border border-border bg-white p-6 shadow-[0_30px_80px_-28px_rgba(7,28,18,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-foreground">Reset Password</h2>
                <p className="text-sm text-muted-foreground">Enter your current password, then set and confirm a new one.</p>
              </div>
              <button
                aria-label="Close reset password dialog"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                onClick={() => setIsPasswordModalOpen(false)}
                type="button"
              >
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                </svg>
              </button>
            </div>
            <form className="mt-5 space-y-4" onSubmit={handlePasswordReset}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="account-current-password">
                  Current password
                </label>
                <div className="relative">
                  <Input
                    className="pr-11"
                    id="account-current-password"
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                  />
                  <button
                    aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                    className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setShowCurrentPassword((current) => !current)}
                    type="button"
                  >
                    {showCurrentPassword ? (
                      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <path d="M3 3L21 21" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                        <path d="M10.58 10.58A2 2 0 0013.42 13.42M9.88 5.09A10.94 10.94 0 0112 4.91c5.05 0 8.27 3.11 9.53 5.09a1.95 1.95 0 010 2c-.55.87-1.44 2.04-2.72 3.08M6.53 6.53C4.7 7.8 3.49 9.43 2.47 11a1.95 1.95 0 000 2C3.73 14.98 6.95 18.09 12 18.09c1.78 0 3.36-.39 4.75-1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                      </svg>
                    ) : (
                      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <path d="M2.46 12C3.73 9.98 6.95 6.91 12 6.91S20.27 9.98 21.54 12C20.27 14.02 17.05 17.09 12 17.09S3.73 14.02 2.46 12Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="account-next-password">
                  New password
                </label>
                <div className="relative">
                  <Input
                    className="pr-11"
                    id="account-next-password"
                    onChange={(event) => setNextPassword(event.target.value)}
                    type={showNextPassword ? "text" : "password"}
                    value={nextPassword}
                  />
                  <button
                    aria-label={showNextPassword ? "Hide new password" : "Show new password"}
                    className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setShowNextPassword((current) => !current)}
                    type="button"
                  >
                    {showNextPassword ? (
                      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <path d="M3 3L21 21" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                        <path d="M10.58 10.58A2 2 0 0013.42 13.42M9.88 5.09A10.94 10.94 0 0112 4.91c5.05 0 8.27 3.11 9.53 5.09a1.95 1.95 0 010 2c-.55.87-1.44 2.04-2.72 3.08M6.53 6.53C4.7 7.8 3.49 9.43 2.47 11a1.95 1.95 0 000 2C3.73 14.98 6.95 18.09 12 18.09c1.78 0 3.36-.39 4.75-1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                      </svg>
                    ) : (
                      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <path d="M2.46 12C3.73 9.98 6.95 6.91 12 6.91S20.27 9.98 21.54 12C20.27 14.02 17.05 17.09 12 17.09S3.73 14.02 2.46 12Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="account-confirm-next-password">
                  Confirm new password
                </label>
                <div className="relative">
                  <Input
                    className="pr-11"
                    id="account-confirm-next-password"
                    onChange={(event) => setConfirmNextPassword(event.target.value)}
                    type={showConfirmNextPassword ? "text" : "password"}
                    value={confirmNextPassword}
                  />
                  <button
                    aria-label={showConfirmNextPassword ? "Hide confirmed new password" : "Show confirmed new password"}
                    className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setShowConfirmNextPassword((current) => !current)}
                    type="button"
                  >
                    {showConfirmNextPassword ? (
                      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <path d="M3 3L21 21" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                        <path d="M10.58 10.58A2 2 0 0013.42 13.42M9.88 5.09A10.94 10.94 0 0112 4.91c5.05 0 8.27 3.11 9.53 5.09a1.95 1.95 0 010 2c-.55.87-1.44 2.04-2.72 3.08M6.53 6.53C4.7 7.8 3.49 9.43 2.47 11a1.95 1.95 0 000 2C3.73 14.98 6.95 18.09 12 18.09c1.78 0 3.36-.39 4.75-1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                      </svg>
                    ) : (
                      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <path d="M2.46 12C3.73 9.98 6.95 6.91 12 6.91S20.27 9.98 21.54 12C20.27 14.02 17.05 17.09 12 17.09S3.73 14.02 2.46 12Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                      </svg>
                    )}
                  </button>
                </div>
                {nextPassword.length > 0 && confirmNextPassword.length > 0 && !passwordResetMatches ? (
                  <p className="text-sm text-red-600">New passwords must match.</p>
                ) : null}
              </div>
              {(passwordErrorMessage || passwordSuccessMessage) ? (
                <p className={passwordErrorMessage ? "text-sm text-red-600" : "text-sm text-emerald-700"}>
                  {passwordErrorMessage ?? passwordSuccessMessage}
                </p>
              ) : null}
              <div className="flex justify-end gap-3">
                <Button
                  onClick={() => setIsPasswordModalOpen(false)}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button disabled={isPasswordSubmitting || !canSubmitPasswordReset} type="submit">
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
          ,
          document.body
        )
        : null}
    </Card>
  );
}
