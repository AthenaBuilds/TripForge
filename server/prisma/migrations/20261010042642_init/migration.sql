-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "destination" VARCHAR(100) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "share_slug" VARCHAR(32),
    "shared_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itinerary_items" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "date" DATE NOT NULL,
    "start_time" VARCHAR(5),
    "end_time" VARCHAR(5),
    "city" VARCHAR(80),
    "location" VARCHAR(120),
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "itinerary_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "trips_share_slug_key" ON "trips"("share_slug");

-- CreateIndex
CREATE INDEX "trips_user_id_idx" ON "trips"("user_id");

-- CreateIndex
CREATE INDEX "itinerary_items_trip_id_date_idx" ON "itinerary_items"("trip_id", "date");

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
