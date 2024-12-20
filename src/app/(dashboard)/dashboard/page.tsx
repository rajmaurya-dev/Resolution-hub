"use client";
import axios from "axios";
import React, { useEffect, useState } from "react";
import { set, useForm } from "react-hook-form";

import { useAuth, useUser } from "@clerk/nextjs";
import toast from "react-hot-toast";

import { LoaderIcon, Pencil, RefreshCcw, Wand } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient } from "@/lib/queries";

const queryKeys = {
  resolutions: ["resolutions"] as const,
};

const formSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(50, "Title must be less than 50 characters"),
  about: z
    .string()
    .min(10, "Please provide more details about your goals")
    .max(500, "Please keep it under 500 characters"),
  goal: z.enum(["realistic", "unrealistic"]),
  category: z.enum([
    "personal",
    "health",
    "career",
    "financial",
    "relationships",
  ]),
});
interface FormData extends z.infer<typeof formSchema> {}
interface AiResponse {
  resolutionName: string;
  isEditing?: boolean;
}
const Create = () => {
  const [mounted, setMounted] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [aiData, setAiData] = useState<AiResponse[]>([]);
  const { userId } = useAuth();
  const { user } = useUser();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      goal: "realistic",
      category: "personal",
    },
  });

  const onSubmit = async (data: FormData) => {
    const MAX_RETRIES = 3;
    let retryCount = 0;
    try {
      setLoading(true);
      setIsGenerating(true);
      const response = await axios.post("/api/ai/realistic", {
        prompt: data.about,
        goal: data.goal,
      });
      try {
        const cleanJsonString = response.data
          .replace(/```json\n/, "")
          .replace(/\n```$/, "");
        const parsedData = JSON.parse(cleanJsonString);
        setAiData(parsedData);
        toast.success("Resolution generated successfully");
      } catch (parseError) {
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          return onSubmit(data);
        } else {
          toast.error("Try again");
          throw new Error("Failed to parse response after multiple attempts");
        }
      }
    } catch (error) {
      setLoading(false);
      toast.error("Error generating resolution");
      console.error(error);
      setIsGenerating(false);
    } finally {
      setLoading(false);
      setIsGenerating(false);
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    const formData = watch();

    try {
      await axios.post("/api/create", {
        title: formData.title,
        userId: userId,
        creatorName: user?.firstName,
        points: aiData?.map((item: AiResponse) => ({
          content: item.resolutionName,
          isCompleted: false,
        })),
        category: formData.category,
        isCompleted: false,
      });
      setLoading(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.resolutions });

      toast.success("Resolution created successfully");
      setAiData([]);
    } catch (error: any) {
      setLoading(false);
      setAiData([]);
      console.error("Error creating resolution:", error);
      toast.error("Error creating resolution", error);
    }
  };
  const handleEdit = (index: number) => {
    const newData = [...aiData];
    newData[index].isEditing = true;
    setAiData(newData);
  };

  const handleSave = (index: number, newContent: string) => {
    if (!newContent.trim()) return;
    const newData = [...aiData];
    newData[index].resolutionName = newContent;
    newData[index].isEditing = false;
    setAiData(newData);
  };

  return (
    <div className="h-screen bg-gray-50">
      {/* Main Content */}
      <div className="flex-1">
        <div className="max-w-7xl mx-auto p-6">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left Column - Form */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h1 className="text-2xl font-bold mb-6">
                Create Your 2024 Resolutions
              </h1>
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-6">
                  {/* Title Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Resolution Title
                    </label>
                    <input
                      {...register("title")}
                      className="w-full rounded-lg border border-gray-200 p-3 text-gray-700 focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
                      placeholder="My 2024 Goals"
                    />
                    {errors.title && (
                      <p className="mt-1 text-sm text-red-500">
                        {errors.title.message}
                      </p>
                    )}
                  </div>

                  {/* Category Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      {...register("category")}
                      className="w-full rounded-lg border border-gray-200 p-3 text-gray-700 focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
                    >
                      <option value="personal">Personal Growth</option>
                      <option value="health">Health & Fitness</option>
                      <option value="career">Career & Education</option>
                      <option value="financial">Financial</option>
                      <option value="relationships">Relationships</option>
                    </select>
                    {errors.category && (
                      <p className="mt-1 text-sm text-red-500">
                        {errors.category.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      What do you want to improve this year?
                    </label>
                    <textarea
                      {...register("about")}
                      className="w-full h-32 rounded-lg border border-gray-200 p-4 text-gray-700 focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all resize-none"
                      placeholder="Tell us about your goals..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Set Your Goal Type:
                    </label>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <input
                          {...register("goal")}
                          type="radio"
                          id="realistic"
                          value="realistic"
                          className="peer hidden"
                        />
                        <label
                          htmlFor="realistic"
                          className="flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all peer-checked:border-green-500 peer-checked:bg-green-50 hover:bg-gray-50"
                        >
                          Realistic
                        </label>
                      </div>
                      <div className="flex-1">
                        <input
                          {...register("goal")}
                          type="radio"
                          id="unrealistic"
                          value="unrealistic"
                          className="peer hidden"
                        />
                        <label
                          htmlFor="unrealistic"
                          className="flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all peer-checked:border-rose-500 peer-checked:bg-rose-50 hover:bg-gray-50"
                        >
                          Unrealistic
                        </label>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-lg font-medium hover:from-rose-600 hover:to-orange-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <LoaderIcon className="animate-spin" />
                    ) : (
                      <>
                        <Wand className="w-5 h-5" />
                        <span>Generate Resolutions</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
            {/* Right Column - Results */}
            <div className="">
              {isGenerating ? (
                <div className="animate-pulse">
                  <div className="flex justify-between items-center mb-6">
                    <div className="h-8 w-48 bg-gray-200 rounded-lg" />
                    <div className="h-8 w-8 bg-gray-200 rounded-lg" />
                  </div>

                  <div className="space-y-3 mb-6">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="flex items-center space-x-4">
                        <div className="h-12 bg-gray-200 rounded-lg w-full" />
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <div className="h-12 bg-gray-200 rounded-lg flex-1" />
                    <div className="h-12 w-24 bg-gray-200 rounded-lg" />
                  </div>
                </div>
              ) : (
                <div
                  className={`bg-white rounded-2xl shadow-sm p-6 transition-all ${
                    aiData.length > 0 ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {aiData.length > 0 && (
                    <>
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold">{watch("title")}</h2>
                        <div className="flex gap-2">
                          <button
                            disabled={loading}
                            onClick={handleSubmit(onSubmit)}
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                          >
                            {loading ? (
                              <LoaderIcon className="w-5 h-5 animate-spin" />
                            ) : (
                              <RefreshCcw size={20} className="text-gray-600" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3 mb-6">
                        {aiData.map((item, index) => (
                          <div
                            key={index}
                            className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group"
                          >
                            {item.isEditing ? (
                              <div className="flex gap-1">
                                <input
                                  type="text"
                                  defaultValue={item.resolutionName}
                                  className="flex-1 px-2 py-1 border rounded-md focus:border-transparent focus:outline-none text-sm"
                                  onBlur={(e) =>
                                    handleSave(index, e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleSave(index, e.currentTarget.value);
                                    }
                                  }}
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <p className="text-gray-700">
                                  {index + 1}. {item.resolutionName}
                                </p>
                                <button
                                  onClick={() => handleEdit(index)}
                                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-all"
                                >
                                  <Pencil size={14} className="text-gray-500" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={handleCreate}
                          disabled={loading}
                          className="flex-1 py-3 bg-rose-500 text-white rounded-lg font-medium hover:bg-rose-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {loading ? (
                            <LoaderIcon className="animate-spin" />
                          ) : (
                            "Create Resolutions"
                          )}
                        </button>
                        <button
                          onClick={() => setAiData([])}
                          className="py-3 px-6 border border-gray-200 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Create;
