<?php

declare(strict_types=1);

namespace App;

use GuzzleHttp\Client;
use Symfony\Component\Process\Process;

class TwitchAutomatorJob
{

	const NO_FILE = 1;
	const NO_DATA = 2;

	public string $name;
	public $pid;
	public string $pidfile;
	public string $pidfile_simple;
	public array $metadata = [];
	public $status;
	public int $error;
	public Process $process;
	// private $tried_loading;

	function __construct(string $name)
	{
		$this->name = $name;
		$this->pidfile = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . $name . '.json';
		$this->pidfile_simple = TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . $name . '.pid';
		return $this;
	}

	/**
	 * Load data from disk
	 *
	 * @return bool successful
	 */
	function load()
	{
		$tried_loading = true;
		if (!file_exists($this->pidfile)) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "job", "Loading job {$this->name} failed, no json file", $this->metadata);
			// return $this->loadSimple();
			$this->error = TwitchAutomatorJob::NO_FILE;
			return false;
		}
		$raw = file_get_contents($this->pidfile);
		if (!$raw) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "job", "Loading job {$this->name} failed, no data in json file", $this->metadata);
			$this->error = TwitchAutomatorJob::NO_DATA;
			return false;
		}
		$data = json_decode($raw);
		$this->pid = $data->pid;

		$this->getStatus();
		return true;
	}

	/*
	function loadSimple()
	{
		$tried_loading = true;
		if (!file_exists($this->pidfile_simple)) {
            TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Loading job {$this->name} failed, no pid file", $this->metadata);
			$this->error = TwitchAutomatorJob::NO_FILE;
			return false;
		}
		$raw = file_get_contents($this->pidfile_simple);
		if (!$raw) {
			$this->error = TwitchAutomatorJob::NO_DATA;
			return false;
		}
		$this->pid = $raw;
		$this->getStatus();
    }
    */

	/**
	 * Save to disk, like when the process starts
	 *
	 * @return bool
	 */
	function save()
	{
		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "job", "Save job {$this->name} with PID {$this->pid}", $this->metadata);

		TwitchHelper::webhook([
			'action' => 'job_save',
			'job_name' => $this->name,
			'job' => $this
		]);

		return file_put_contents($this->pidfile, json_encode($this)) != false;
	}

	/**
	 * Remove from disk, like when the process quits
	 *
	 * @return bool success
	 */
	function clear()
	{
		if (isset($this->process)) {
			$this->process = null;
		}

		if (file_exists($this->pidfile)) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "job", "Clear job {$this->name} with PID {$this->pid}", $this->metadata);
			
			TwitchHelper::webhook([
				'action' => 'job_clear',
				'job_name' => $this->name,
				'job' => $this
			]);

			return unlink($this->pidfile);
		}
		return false;
	}

	/**
	 * Set process PID
	 *
	 * @param int $pid
	 * @return void
	 */
	function setPid($pid)
	{
		$this->pid = $pid;
	}

	/**
	 * Get process PID
	 *
	 * @return int Process ID
	 */
	function getPid()
	{
		if (!$this->pid) {
			$this->load();
		}
		return $this->pid;
	}

	/**
	 * Attach process
	 *
	 * @param Process $process
	 * @return void
	 */
	function setProcess(Process $process)
	{
		// $this->process = $process;
	}

	/**
	 * Attach metadata
	 *
	 * @param array $metadata
	 * @return void
	 */
	function setMetadata(array $metadata)
	{
		$this->metadata = $metadata;
	}

	/**
	 * Get running status of job, PID if running.
	 *
	 * @return int|false
	 */
	function getStatus()
	{
		$pid = $this->getPid();

		if (!$pid) {
			return false;
		}

		$output = TwitchHelper::exec(["ps", "-p", $pid]);

		//if (!$this->pid && !$this->tried_loading) {
		//	$this->load();
		//}
		//
		//if (!$this->pid) {
		//	return false;
		//}

		if (mb_strpos($output, (string)$pid) !== false) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "job", "PID file check, process is running");
			$this->status = $pid;
			return $pid;
		} else {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "job", "PID file check, process does not exist");
			$this->status = false;
			return false;
		}
	}

	/**
	 * Quit the process via PID
	 *
	 * @return string kill output
	 */
	function kill()
	{
		if (isset($this->process)) {
			return $this->process->stop();
		}
		$exec = TwitchHelper::exec(["kill", $this->getPid()]);
		$this->clear();
		return $exec;
	}
}
