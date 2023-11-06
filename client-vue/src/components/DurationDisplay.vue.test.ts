import { mount } from "@vue/test-utils";
import DurationDisplay from "@/components/DurationDisplay.vue";
import { describe, it, expect } from "vitest";

describe("DurationDisplay", () => {
  it("displays the correct duration in human format", async () => {
    const startDate = new Date(Date.now() - 10000); // 10 seconds ago
    const wrapper = mount(DurationDisplay, {
      props: {
        startDate,
        outputStyle: "human",
      },
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toMatch(/10s?/i);
  });

  it("displays the correct duration in humanLong format", async () => {
    const startDate = new Date(Date.now() - 10000); // 10 seconds ago
    const wrapper = mount(DurationDisplay, {
      props: {
        startDate,
        outputStyle: "humanLong",
      },
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toMatch(/10 seconds/i);
  });

  it("displays the correct duration in numbers format", async () => {
    const startDate = new Date(Date.now() - 10000); // 10 seconds ago
    const wrapper = mount(DurationDisplay, {
      props: {
        startDate,
        outputStyle: "numbers",
      },
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toMatch(/00:00:10/i);
  });

  it("displays an error message when startDate prop is invalid", async () => {
    const wrapper = mount(DurationDisplay, {
      props: {
        startDate: "invalid date",
      },
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toMatch(/invalid output style/i);
  });

  it("displays an error message when outputStyle prop is invalid", async () => {
    const startDate = new Date(Date.now() - 10000); // 10 seconds ago
    const wrapper = mount(DurationDisplay, {
      props: {
        startDate,
        outputStyle: "invalid" as any,
      },
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toMatch(/invalid output style/i);
  });
});